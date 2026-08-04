import { createServer } from "node:http";
import { readFile, mkdir, writeFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { randomUUID } from "node:crypto";
import mysql from "mysql2/promise";
import { verifyPassword } from "./auth.js";

const { MYSQL_HOST, MYSQL_PORT = "3306", MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD } = process.env;
if (
  MYSQL_HOST == null ||
  MYSQL_DATABASE == null ||
  MYSQL_USER == null ||
  MYSQL_PASSWORD == null
) {
  throw new Error(
    "Set MYSQL_HOST, MYSQL_DATABASE, MYSQL_USER, and MYSQL_PASSWORD in .env before starting the server."
  );
}

const root = process.cwd();
const uploadDirectory = process.env.UPLOAD_DIRECTORY || "/app/uploads";
await mkdir(uploadDirectory, { recursive: true });
const database = mysql.createPool({ host: MYSQL_HOST, port: Number(MYSQL_PORT), database: MYSQL_DATABASE, user: MYSQL_USER, password: MYSQL_PASSWORD, connectionLimit: 5 });
await database.query(`CREATE TABLE IF NOT EXISTS admins (
  id CHAR(36) PRIMARY KEY,
  username VARCHAR(60) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
)`);
await database.query(`CREATE TABLE IF NOT EXISTS memories (
  id CHAR(36) PRIMARY KEY,
  title VARCHAR(50) NOT NULL,
  note VARCHAR(220) NOT NULL,
  image_url VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
)`);
await database.query(`CREATE TABLE IF NOT EXISTS site_settings (
  setting_key VARCHAR(80) PRIMARY KEY,
  setting_value VARCHAR(500) NOT NULL
)`);

const sessions = new Map();
const mimeTypes = { ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif" };
const send = (response, status, body, type = "application/json; charset=utf-8", headers = {}) => { response.writeHead(status, { "Content-Type": type, "Access-Control-Allow-Origin": "*", ...headers }); response.end(type.includes("application/json") ? JSON.stringify(body) : body); };
const readBody = (request) => new Promise((resolve, reject) => { const chunks = []; let size = 0; request.on("data", (chunk) => { size += chunk.length; if (size > 8 * 1024 * 1024) reject(new Error("Upload must be 8 MB or smaller.")); else chunks.push(chunk); }); request.on("end", () => resolve(Buffer.concat(chunks))); request.on("error", reject); });
const cookies = (request) => Object.fromEntries((request.headers.cookie || "").split(";").map((part) => part.trim().split("=")).filter(([key]) => key));
const sessionFor = (request) => { const session = sessions.get(cookies(request).memory_admin); return session?.expiresAt > Date.now() ? session : null; };

function parseMultipart(body, contentType) {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
  const boundary = match?.[1] || match?.[2];
  if (!boundary) throw new Error("Missing form boundary.");
  const fields = {}; const files = {};
  for (const section of body.toString("latin1").split(`--${boundary}`).slice(1, -1)) {
    const headerEnd = section.indexOf("\r\n\r\n"); if (headerEnd === -1) continue;
    const headers = section.slice(0, headerEnd); const name = headers.match(/name="([^"]+)"/)?.[1]; if (!name) continue;
    const content = section.slice(headerEnd + 4).replace(/\r\n$/, ""); const filename = headers.match(/filename="([^"]*)"/)?.[1];
    if (filename) files[name] = { filename, mime: headers.match(/Content-Type:\s*([^\r\n]+)/i)?.[1] || "application/octet-stream", buffer: Buffer.from(content, "latin1") };
    else fields[name] = Buffer.from(content, "latin1").toString("utf8");
  }
  return { fields, files };
}

async function serveFile(response, requestedPath) {
  const relativePath = requestedPath === "/" ? "index.html" : requestedPath.slice(1);
  const filePath = normalize(join(root, relativePath));
  if (!filePath.startsWith(root) || !existsSync(filePath)) return send(response, 404, "Not found", "text/plain; charset=utf-8");
  try { send(response, 200, await readFile(filePath), mimeTypes[extname(filePath).toLowerCase()] || "application/octet-stream"); } catch { send(response, 404, "Not found", "text/plain; charset=utf-8"); }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (request.method === "GET" && url.pathname === "/api/memories") {
    const [rows] = await database.execute("SELECT id, title, note, image_url AS imageUrl FROM memories ORDER BY created_at ASC");
    return send(response, 200, rows);
  }
  if (request.method === "GET" && url.pathname === "/api/music") {
    const [rows] = await database.execute("SELECT setting_value AS playlistUrl FROM site_settings WHERE setting_key = 'music_playlist'");
    return send(response, 200, { playlistUrl: rows[0]?.playlistUrl || "" });
  }
  if (request.method === "POST" && url.pathname === "/api/admin/login") {
    try {
      const { username, password } = JSON.parse((await readBody(request)).toString("utf8"));
      const [rows] = await database.execute("SELECT id, password_hash FROM admins WHERE username = ?", [String(username || "")]);
      if (!rows[0] || !(await verifyPassword(String(password || ""), rows[0].password_hash))) return send(response, 401, { error: "Invalid username or password." });
      const token = randomUUID(); sessions.set(token, { adminId: rows[0].id, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
      return send(response, 200, { ok: true }, "application/json; charset=utf-8", { "Set-Cookie": `memory_admin=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400` });
    } catch { return send(response, 400, { error: "Could not validate this login." }); }
  }
  if (request.method === "PUT" && url.pathname === "/api/music") {
    if (!sessionFor(request)) return send(response, 401, { error: "Admin login required." });
    try {
      const { playlistUrl } = JSON.parse((await readBody(request)).toString("utf8"));
      const value = String(playlistUrl || "").trim();
      if (value && !/^https:\/\/(www\.)?(youtube\.com|youtu\.be|open\.spotify\.com)\//i.test(value)) return send(response, 400, { error: "Use a valid YouTube or Spotify playlist link." });
      await database.execute("INSERT INTO site_settings (setting_key, setting_value) VALUES ('music_playlist', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)", [value]);
      return send(response, 200, { playlistUrl: value });
    } catch { return send(response, 400, { error: "Could not save this playlist." }); }
  }
  if (request.method === "GET" && url.pathname === "/api/admin/session") return send(response, 200, { authenticated: Boolean(sessionFor(request)) });
  if (request.method === "POST" && url.pathname === "/api/admin/logout") return send(response, 200, { ok: true }, "application/json; charset=utf-8", { "Set-Cookie": "memory_admin=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0" });
  if (request.method === "POST" && url.pathname === "/api/memories") {
    if (!sessionFor(request)) return send(response, 401, { error: "Admin login required." });
    try {
      const { fields, files } = parseMultipart(await readBody(request), request.headers["content-type"] || ""); const photo = files.photo; const title = fields.title?.trim(); const note = fields.note?.trim() || "A moment worth remembering.";
      if (!title || !photo || !photo.mime.startsWith("image/")) return send(response, 400, { error: "A title and image are required." });
      const extension = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(extname(photo.filename).toLowerCase()) ? extname(photo.filename).toLowerCase() : ".jpg";
      const imageUrl = `/data/uploads/${randomUUID()}${extension}`; await writeFile(join(root, imageUrl.slice(1)), photo.buffer);
      const memory = { id: randomUUID(), title: title.slice(0, 50), note: note.slice(0, 220), imageUrl };
      await database.execute("INSERT INTO memories (id, title, note, image_url) VALUES (?, ?, ?, ?)", [memory.id, memory.title, memory.note, memory.imageUrl]);
      return send(response, 201, memory);
    } catch (error) { return send(response, 400, { error: error.message || "Could not save this memory." }); }
  }
  if (request.method === "DELETE" && /^\/api\/memories\/[\w-]+$/.test(url.pathname)) {
    if (!sessionFor(request)) return send(response, 401, { error: "Admin login required." });
    const id = url.pathname.split("/").at(-1);
    const [rows] = await database.execute("SELECT image_url FROM memories WHERE id = ?", [id]);
    if (!rows[0]) return send(response, 404, { error: "Memory not found." });
    await database.execute("DELETE FROM memories WHERE id = ?", [id]);
    const imageUrl = rows[0].image_url;
    if (imageUrl.startsWith("/data/uploads/")) await unlink(join(root, imageUrl.slice(1))).catch(() => {});
    return send(response, 200, { ok: true });
  }
  if (request.method === "GET" && url.pathname === "/admin") return serveFile(response, "/admin.html");
  return serveFile(response, url.pathname);
});

server.listen(process.env.PORT || 3000, () => console.log("Memory vault running at http://localhost:3000"));
