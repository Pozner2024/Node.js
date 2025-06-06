import { fileURLToPath } from "url";
import path from "path";
import session from "express-session";
const Store = session.Store;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const HTTP_PORT = 3000;
export const WS_PORT = 3001;

export const CLIENT_DIR = path.join(__dirname, "..", "..", "client");
export const UPLOAD_DIR = path.join(__dirname, "..", "uploads");

// Конфигурация базы данных
export const dbConfig = {
  host: "localhost",
  user: "root",
  password: "",
  database: "file_storage",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

// Конфигурация SMTP для отправки писем
export const emailConfig = {
  service: "gmail",
  auth: {
    user: "natalyapoznyak@gmail.com",
    pass: "sqbieqnwutzzqcww",
  },
};

// Конфигурация сессии
export const sessionConfig = {
  secret: "ОченьСекретнаяСтрокаДляПодписания",
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 1 день
  },
  unset: "destroy",
};

// Создаем простое хранилище сессий в памяти
export class CustomSessionStore extends Store {
  constructor() {
    super();
    this.sessions = new Map();
  }

  get(sid, callback) {
    const session = this.sessions.get(sid);
    if (callback) callback(null, session);
    return session;
  }

  set(sid, session, callback) {
    this.sessions.set(sid, session);
    if (callback) callback();
  }

  destroy(sid, callback) {
    this.sessions.delete(sid);
    if (callback) callback();
  }

  // Добавляем недостающие методы
  all(callback) {
    const sessions = Array.from(this.sessions.values());
    if (callback) callback(null, sessions);
    return sessions;
  }

  length(callback) {
    const length = this.sessions.size;
    if (callback) callback(null, length);
    return length;
  }

  clear(callback) {
    this.sessions.clear();
    if (callback) callback();
  }

  touch(sid, session, callback) {
    if (this.sessions.has(sid)) {
      this.sessions.set(sid, session);
    }
    if (callback) callback();
  }
}
