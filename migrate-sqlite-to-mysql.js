// One-time migration helper for users who have existing data in the old
// local SQLite database (data/memories.sqlite) and want to move it into
// the MySQL database now used by the app.
//
// This script is NOT run automatically. Run it manually, once, if you
// have a pre-existing data/memories.sqlite file you want to preserve:
//
//   npm install better-sqlite3   # temporary, only needed to run this script
//   node --env-file-if-exists=.env migrate-sqlite-to-mysql.js
//
// It reads the "admins" and "memories" tables from the SQLite file and
// inserts any rows that don't already exist into the MySQL database
// configured via MYSQL_HOST / MYSQL_DATABASE / MYSQL_USER / MYSQL_PASSWORD.
//
// better-sqlite3 is intentionally not a dependency of this project. Install
// it temporarily (as shown above) only if you need to run this migration.

import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import mysql from "mysql2/promise";

const SQLITE_PATH = process.env.SQLITE_PATH || "data/memories.sqlite";

const { MYSQL_HOST, MYSQL_PORT = "3306", MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD } = process.env;
if (!MYSQL_HOST || !MYSQL_DATABASE || !MYSQL_USER || MYSQL_PASSWORD == null) {
  throw new Error("Set MYSQL_HOST, MYSQL_DATABASE, MYSQL_USER, and MYSQL_PASSWORD in .env before running this migration.");
}

if (!existsSync(SQLITE_PATH)) {
  console.log(`No SQLite database found at "${SQLITE_PATH}". Nothing to migrate.`);
  process.exit(0);
}

let Database;
try {
  ({ default: Database } = await import("better-sqlite3"));
} catch {
  console.error(
    'Could not load "better-sqlite3". Install it temporarily with `npm install better-sqlite3` and run this script again.'
  );
  process.exit(1);
}

const sqlite = new Database(SQLITE_PATH, { readonly: true });
const connection = await mysql.createConnection({
  host: MYSQL_HOST,
  port: Number(MYSQL_PORT),
  database: MYSQL_DATABASE,
  user: MYSQL_USER,
  password: MYSQL_PASSWORD,
});

await connection.execute(`CREATE TABLE IF NOT EXISTS admins (
  id CHAR(36) PRIMARY KEY,
  username VARCHAR(60) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
)`);
await connection.execute(`CREATE TABLE IF NOT EXISTS memories (
  id CHAR(36) PRIMARY KEY,
  title VARCHAR(50) NOT NULL,
  note VARCHAR(220) NOT NULL,
  image_url VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
)`);

let migratedAdmins = 0;
let migratedMemories = 0;

const admins = sqlite.prepare("SELECT * FROM admins").all();
for (const admin of admins) {
  const [result] = await connection.execute(
    "INSERT INTO admins (id, username, password_hash) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)",
    [admin.id ?? admin.rowid?.toString() ?? randomUUID(), admin.username, admin.password_hash]
  );
  if (result.affectedRows) migratedAdmins += 1;
}

const memories = sqlite.prepare("SELECT * FROM memories").all();
for (const memory of memories) {
  const [result] = await connection.execute(
    "INSERT IGNORE INTO memories (id, title, note, image_url) VALUES (?, ?, ?, ?)",
    [memory.id ?? memory.rowid?.toString() ?? randomUUID(), memory.title, memory.note, memory.image_url]
  );
  if (result.affectedRows) migratedMemories += 1;
}

sqlite.close();
await connection.end();

console.log(`Migrated ${migratedAdmins} admin(s) and ${migratedMemories} memory record(s) from SQLite to MySQL.`);
console.log("You can now safely delete data/memories.sqlite.");
