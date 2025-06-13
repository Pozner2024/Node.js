import "./init-env.js";
import { fileURLToPath } from "url";
import path from "path";
import session from "express-session";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const requireEnv = (name) => {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Environment variable ${name} is required but not set. Please check your .env file.`
    );
  }
  return v;
};

export const HTTP_PORT = parseInt(process.env.HTTP_PORT || "3000");
export const WS_PORT = parseInt(process.env.WS_PORT || "3001");
export const CLIENT_DIR = path.join(__dirname, "..", "..", "client");
export const UPLOAD_DIR = path.join(__dirname, "..", "uploads");

// Конфигурация базы данных
export const dbConfig = {
  host: "127.0.0.1",
  port: 3306,
  user: "root",
  password: "",
  database: "file_storage",
  waitForConnections: true,

  connectionLimit: 10,
  queueLimit: 0,
};

// export const dbConfig = {
//   host: requireEnv("DB_HOST"),
//   port: parseInt(requireEnv("DB_PORT")),
//   user: requireEnv("DB_USER"),
//   password: requireEnv("DB_PASSWORD"),
//   database: requireEnv("DB_NAME"),
//   waitForConnections: true,
//   connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || "10"),
//   queueLimit: parseInt(process.env.DB_QUEUE_LIMIT || "0"),
// };

export const emailConfig = {
  host: requireEnv("EMAIL_HOST"),
  port: parseInt(requireEnv("EMAIL_PORT")),
  auth: {
    user: requireEnv("EMAIL_USER"),
    pass: requireEnv("EMAIL_PASSWORD"),
  },
  secure: parseInt(process.env.EMAIL_PORT) === 465,
};

const Store = session.Store;

export class CustomSessionStore extends Store {
  constructor() {
    super();
    this.sessions = new Map();
  }

  get(sid, callback) {
    const data = this.sessions.get(sid);
    callback(null, data);
  }

  set(sid, session, callback) {
    this.sessions.set(sid, session);
    if (typeof callback === "function") callback(null);
  }

  destroy(sid, callback) {
    this.sessions.delete(sid);
    if (typeof callback === "function") callback(null);
  }
}

export const sessionConfig = {
  store: new CustomSessionStore(),
  secret: requireEnv("SESSION_SECRET"),
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: parseInt(process.env.SESSION_COOKIE_MAX_AGE || "86400000"),
    secure: process.env.NODE_ENV === "production",
  },
};
