import mysql from "mysql2/promise";
import { dbConfig } from "./config.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pool;

export async function initDbPool() {
  try {
    // Создаем пул подключений к существующей базе данных
    pool = await mysql.createPool(dbConfig);

    // Проверяем подключение
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

// Функции для работы с пользователями
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

export async function createUser(email, passwordHash, activationToken) {
  const pool = await getPool();
  await pool.query(
    "INSERT INTO users (user_email, password_hash, is_active, activation_token) VALUES (?, ?, 0, ?)",
    [email, passwordHash, activationToken]
  );
}

export async function activateUser(token) {
  const pool = await getPool();
  const [rows] = await pool.query(
    "SELECT user_email FROM users WHERE activation_token = ? AND is_active = 0",
    [token]
  );
  if (rows.length === 0) {
    return null;
  }

  const email = rows[0].user_email;
  await pool.query(
    "UPDATE users SET is_active = 1, activation_token = NULL WHERE user_email = ?",
    [email]
  );
  return email;
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
