// server/server.js
import express from "express";
import session from "express-session";
import path from "path";
import fs from "fs";
import { WebSocketServer } from "ws";

import {
  HTTP_PORT,
  WS_PORT,
  CLIENT_DIR,
  UPLOAD_DIR,
  sessionConfig,
  CustomSessionStore,
} from "./modules/config.js";
import { initDbPool } from "./modules/db.js";
import { requireAuth, setupAuthRoutes } from "./modules/auth.js";
import {
  setupUploadRoutes,
  handleWebSocketConnection,
} from "./modules/upload.js";

// === 1) Инициализируем базу данных ===
await initDbPool();

// === 2) Убеждаемся, что папка uploads существует ===
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// === 3) Создаем Express приложение ===
const webserver = express();

// Создаем экземпляр хранилища сессий
const sessionStore = new CustomSessionStore();

// Базовые middleware
webserver.use(express.static(CLIENT_DIR, { index: false }));
webserver.use(express.urlencoded({ extended: true }));
webserver.use(express.json());

// Настраиваем сессии с кастомным хранилищем
const sessionMiddleware = session({
  ...sessionConfig,
  store: sessionStore,
});

webserver.use(sessionMiddleware);

// Middleware для работы с localStorage
webserver.use((req, res, next) => {
  const sessionId = req.headers["x-session-id"];
  if (sessionId) {
    req.sessionID = sessionId;
    sessionStore.get(sessionId, (err, session) => {
      if (err) return next(err);
      if (session) {
        req.session = session;
      }
      next();
    });
  } else {
    next();
  }
});

// === 4) Настраиваем маршруты ===

// Главная страница (форма входа)
webserver.get("/", (req, res) => {
  if (req.session && req.session.user_email) {
    res.redirect("/app");
  } else {
    res.sendFile(path.join(CLIENT_DIR, "login.html"));
  }
});

// Страница приложения (требует авторизации)
webserver.get("/app", requireAuth, (req, res) => {
  res.sendFile(path.join(CLIENT_DIR, "index.html"));
});

// Маршрут для проверки авторизации
webserver.get("/whoami", requireAuth, (req, res) => {
  res.json({ username: req.session.user_email });
});

// Настраиваем маршруты аутентификации
setupAuthRoutes(webserver);

// Защищенные маршруты для работы с файлами
webserver.use(requireAuth);
setupUploadRoutes(webserver);

// === 5) Запускаем HTTP сервер ===
webserver.listen(HTTP_PORT, () => {
  console.log(`HTTP listening on http://localhost:${HTTP_PORT}`);
});

// === 6) Запускаем WebSocket сервер ===
const wss = new WebSocketServer({ port: WS_PORT });
console.log(`WebSocket listening on ws://localhost:${WS_PORT}`);

wss.on("connection", handleWebSocketConnection);
