import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { WebSocketServer } from "ws";
import { fileURLToPath } from "url";
import { URL } from "url";

const HTTP_PORT = 3000;
const WS_PORT = 3001;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CLIENT_DIR = path.join(__dirname, "..", "client");
const UPLOAD_DIR = path.join(__dirname, "uploads");
const META_PATH = path.join(UPLOAD_DIR, "metadata.json");

// Инициализация директорий и метаданных
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(META_PATH)) fs.writeFileSync(META_PATH, "{}");
let metadata = JSON.parse(fs.readFileSync(META_PATH, "utf-8"));
function saveMeta() {
  fs.writeFileSync(META_PATH, JSON.stringify(metadata, null, 2));
}

// WS-сервер для прогресса загрузки
const wss = new WebSocketServer({ port: WS_PORT });
const clients = new Set();

wss.on("connection", (ws, req) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host}`);
  ws.uploadId = reqUrl.searchParams.get("uploadId");
  clients.add(ws);
  ws.on("close", () => clients.delete(ws));
});

function broadcastProgress(pct, uploadId) {
  for (const ws of clients) {
    if (ws.readyState === 1 && ws.uploadId === uploadId) {
      ws.send(JSON.stringify({ progress: pct }));
    }
  }
}

console.log(`WebSocket on ws://localhost:${WS_PORT}`);

const webserver = express();
webserver.use(express.static(CLIENT_DIR));
webserver.get("/", (req, res) =>
  res.sendFile(path.join(CLIENT_DIR, "index.html"))
);

// 1) Список загруженных файлов
webserver.get("/files", (req, res) => {
  const list = [];
  for (const [stored, { original, comment }] of Object.entries(metadata)) {
    const full = path.join(UPLOAD_DIR, stored);
    if (fs.existsSync(full)) {
      list.push({ filename: stored, originalname: original, comment });
    }
  }
  res.json(list);
});

// 2) Скачивание файла
webserver.get("/download/:filename", (req, res) => {
  const fn = req.params.filename;
  const full = path.join(UPLOAD_DIR, fn);
  if (!fs.existsSync(full)) {
    return res.status(404).send("Файл не найден");
  }
  const { original } = metadata[fn] || {};
  res.download(full, original || fn);
});

// 3) Удаление файла
webserver.delete("/files/:filename", (req, res) => {
  const fn = req.params.filename;
  const full = path.join(UPLOAD_DIR, fn);
  fs.unlink(full, (err) => {
    if (err) return res.status(500).json({ error: "Не удалось удалить" });
    delete metadata[fn];
    saveMeta();
    res.json({ success: true });
  });
});

// 4) Загрузка с прогрессом
const upload = multer({ dest: UPLOAD_DIR });
webserver.post("/upload", (req, res) => {
  const total = parseInt(req.headers["content-length"] || "0", 10);
  const uploadId = req.headers["x-upload-id"];
  let loaded = 0;

  req.on("data", (chunk) => {
    loaded += chunk.length;
    const pct = Math.floor((loaded / total) * 100);
    broadcastProgress(Math.min(pct, 99), uploadId);
  });

  upload.single("file")(req, res, (err) => {
    if (err) return res.status(500).json({ error: err.message });

    broadcastProgress(100, uploadId);

    const stored = req.file.filename;
    const original = Buffer.from(req.file.originalname, "latin1").toString(
      "utf8"
    );
    const comment = req.body.comment || "";

    metadata[stored] = { original, comment };
    saveMeta();

    res.json({ filename: stored, originalname: original });
  });
});

webserver.listen(HTTP_PORT, () => {
  console.log(`HTTP on http://localhost:${HTTP_PORT}`);
});
