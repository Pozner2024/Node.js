import mysql from "mysql2/promise";
import { dbConfig } from "./config.js";

let pool;

export async function initDbPool() {
  try {
    pool = await mysql.createPool(dbConfig);
    await pool.query("SELECT 1");
    console.log("✓ База данных успешно инициализирована");
  } catch (err) {
    console.error("Ошибка при инициализации базы данных:", err);
    throw err;
  }
  return pool;
}

export async function getPool() {
  if (!pool) {
    await initDbPool();
  }
  return pool;
}

export async function findUserByEmail(email) {
  const pool = await getPool();
  const [rows] = await pool.query("SELECT * FROM users WHERE user_email = ?", [
    email,
  ]);
  return rows[0];
}

export async function findActiveUserByEmail(email) {
  const pool = await getPool();
  const [rows] = await pool.query(
    "SELECT * FROM users WHERE user_email = ? AND is_active = 1",
    [email]
  );
  return rows[0];
}

export async function createUser(email, passwordHash) {
  const pool = await getPool();
  await pool.query(
    "INSERT INTO users (user_email, password_hash, is_active) VALUES (?, ?, 1)",
    [email, passwordHash]
  );
}

// Функции для работы с файлами
export async function saveFile(filename, originalname, userId, comment) {
  const pool = await getPool();
  await pool.query(
    "INSERT INTO files (filename, originalname, user_id, comment) VALUES (?, ?, ?, ?)",
    [filename, originalname, userId, comment]
  );
}

export async function getUserFiles(userId) {
  const pool = await getPool();
  const [rows] = await pool.query(
    "SELECT * FROM files WHERE user_id = ? ORDER BY created_at DESC",
    [userId]
  );
  return rows;
}

export async function deleteFile(filename, userId) {
  const pool = await getPool();
  await pool.query("DELETE FROM files WHERE filename = ? AND user_id = ?", [
    filename,
    userId,
  ]);
}

export async function findFileByName(filename, userId) {
  const pool = await getPool();
  const [rows] = await pool.query(
    "SELECT * FROM files WHERE filename = ? AND user_id = ?",
    [filename, userId]
  );
  return rows[0];
}
