import multer from "multer";
import path from "path";
import fs from "fs";
import { UPLOAD_DIR } from "./config.js";
import { saveFile, getUserFiles, deleteFile, findFileByName } from "./db.js";

// Создаем директорию для загрузки, если её нет
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // Сохраняем оригинальное имя файла как есть
    const originalname = file.originalname;

    // Генерируем уникальное имя файла
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(originalname);

    // Используем простое имя файла без специальной обработки
    const safeName = uniqueSuffix + ext;

    cb(null, safeName);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
}).single("file");

// WebSocket клиенты для отправки прогресса загрузки
const wsClients = new Map();

// Функция для отправки прогресса всем подключенным клиентам
function broadcastProgress(pct, uploadId) {
  if (wsClients.has(uploadId)) {
    const ws = wsClients.get(uploadId);
    ws.send(JSON.stringify({ progress: pct }));
  }
}

// Маршруты для работы с файлами
export function setupUploadRoutes(app) {
  // POST /upload → загрузка файла
  app.post("/upload", (req, res) => {
    upload(req, res, async (err) => {
      try {
        if (err instanceof multer.MulterError) {
          // Ошибка multer
          console.error("Ошибка Multer при загрузке:", err);
          return res.status(400).json({
            error:
              err.code === "LIMIT_FILE_SIZE"
                ? "Файл слишком большой (максимум 50MB)"
                : "Ошибка при загрузке файла",
          });
        } else if (err) {
          // Другая ошибка
          console.error("Ошибка при загрузке файла:", err);
          return res.status(500).json({ error: "Ошибка при загрузке файла" });
        }

        if (!req.file || !req.body.comment) {
          return res
            .status(400)
            .json({ error: "Нужно выбрать файл и добавить комментарий" });
        }

        const uploadId = req.headers["x-upload-id"];
        if (uploadId) {
          broadcastProgress(100, uploadId);
        }

        // Сохраняем оригинальное имя файла как есть
        await saveFile(
          req.file.filename,
          req.file.originalname,
          req.user.id,
          req.body.comment
        );

        res.json({
          originalname: req.file.originalname,
          filename: req.file.filename,
        });
      } catch (err) {
        console.error("Ошибка при сохранении файла в БД:", err);
        // Удаляем загруженный файл при ошибке сохранения в БД
        if (req.file) {
          fs.unlink(req.file.path, (unlinkErr) => {
            if (unlinkErr)
              console.error("Ошибка при удалении файла:", unlinkErr);
          });
        }
        res.status(500).json({ error: "Ошибка при сохранении файла" });
      }
    });
  });

  // GET /files → список файлов пользователя
  app.get("/files", async (req, res) => {
    try {
      const files = await getUserFiles(req.user.id);
      // Отправляем имена файлов как есть, без дополнительной обработки
      res.json(files);
    } catch (err) {
      console.error("Ошибка при получении списка файлов:", err);
      res.status(500).json({ error: "Ошибка при получении списка файлов" });
    }
  });

  // GET /download/:filename → скачивание файла
  app.get("/download/:filename", async (req, res) => {
    try {
      const file = await findFileByName(req.params.filename, req.user.id);
      if (!file) {
        return res.status(404).send("Файл не найден");
      }

      const filePath = path.join(UPLOAD_DIR, req.params.filename);
      // Отправляем оригинальное имя файла как есть
      res.download(filePath, file.originalname);
    } catch (err) {
      console.error("Ошибка при скачивании файла:", err);
      res.status(500).send("Ошибка при скачивании файла");
    }
  });

  // DELETE /files/:filename → удаление файла
  app.delete("/files/:filename", async (req, res) => {
    try {
      const file = await findFileByName(req.params.filename, req.user.id);
      if (!file) {
        return res.status(404).send("Файл не найден");
      }

      const filePath = path.join(UPLOAD_DIR, req.params.filename);

      // Удаляем из БД
      await deleteFile(req.params.filename, req.user.id);

      // Удаляем физический файл
      fs.unlink(filePath, (err) => {
        if (err) console.error("Ошибка при удалении файла:", err);
      });

      res.status(200).send("OK");
    } catch (err) {
      console.error("Ошибка при удалении файла:", err);
      res.status(500).send("Ошибка при удалении файла");
    }
  });
}

// Функции для работы с WebSocket
export function handleWebSocketConnection(ws, req) {
  const uploadId = new URL(req.url, "http://localhost").searchParams.get(
    "uploadId"
  );
  if (uploadId) {
    wsClients.set(uploadId, ws);

    ws.on("close", () => {
      wsClients.delete(uploadId);
    });
  }
}
