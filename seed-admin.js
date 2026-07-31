import mysql from "mysql2/promise";
import { randomUUID } from "node:crypto";
import { hashPassword } from "./auth.js";

const { MYSQL_HOST, MYSQL_PORT = "3306", MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD, ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;
if (
  !MYSQL_HOST ||
  !MYSQL_DATABASE ||
  !MYSQL_USER ||
  ADMIN_USERNAME == null ||
  ADMIN_PASSWORD == null
) {
  throw new Error("Set the MYSQL_* and ADMIN_* values in .env before creating an admin.");
}

const connection = await mysql.createConnection({ host: MYSQL_HOST, port: Number(MYSQL_PORT), database: MYSQL_DATABASE, user: MYSQL_USER, password: MYSQL_PASSWORD });
await connection.execute(`CREATE TABLE IF NOT EXISTS admins (
  id CHAR(36) PRIMARY KEY,
  username VARCHAR(60) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
)`);
const passwordHash = await hashPassword(ADMIN_PASSWORD);
const id = randomUUID();
await connection.execute(
  "INSERT INTO admins (id, username, password_hash) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)",
  [id, ADMIN_USERNAME, passwordHash],
);
await connection.end();
console.log(`Admin '${ADMIN_USERNAME}' is ready.`);
