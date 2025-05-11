import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { engine } from "express-handlebars";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const webserver = express();
const PORT = 3000;

const DATA_PATH = path.join(__dirname, "postman_data.json");
const CLIENT_PATH = path.join(__dirname, "..", "client");

webserver.engine("handlebars", engine());
webserver.set("view engine", "handlebars");
webserver.set("views", path.join(__dirname, "views"));

webserver.use(express.json());
webserver.use("/", express.static(CLIENT_PATH));

// возвращает HTML-список
webserver.get("/saved-requests-html", async (req, res) => {
  try {
    const data = await fs.promises.readFile(DATA_PATH, "utf8");
    const list = JSON.parse(data || "[]");
    res.render("requestList", { requests: list, layout: false });
  } catch (err) {
    res.render("requestList", { requests: [], layout: false });
  }
});

webserver.get("/proxy", (req, res) => {
  fs.readFile(DATA_PATH, "utf8", (err, data) => {
    if (err) return res.json([]);
    try {
      res.json(JSON.parse(data));
    } catch {
      res.json([]);
    }
  });
});

// Сохранение и выполнение запросов
webserver.post("/proxy", async (req, res) => {
  const { method, url, headers, body, isExecution, id } = req.body;

  if (!isExecution && typeof id !== "number") {
    const newReq = { method, url, headers, body };
    fs.readFile(DATA_PATH, "utf8", (err, data) => {
      const list = err ? [] : JSON.parse(data || "[]");

      const isDuplicate = list.some(
        (r) =>
          r.method === newReq.method &&
          r.url === newReq.url &&
          JSON.stringify(r.headers) === JSON.stringify(newReq.headers) &&
          JSON.stringify(r.body) === JSON.stringify(newReq.body)
      );

      if (isDuplicate) {
        return res.status(200).json({ message: "Запрос уже существует" });
      }

      list.push(newReq);
      fs.writeFile(DATA_PATH, JSON.stringify(list, null, 2), (err) => {
        if (err) return res.status(500).json({ error: "Ошибка сохранения" });
        res.status(201).json({ message: "Сохранено" });
      });
    });
    return;
  }

  // Выполнение запроса
  try {
    let cfg = { method, url, headers, body };
    if (typeof id === "number") {
      const list = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
      if (!list[id]) return res.status(404).json({ error: "Запрос не найден" });
      cfg = list[id];
    }

    const opts = {
      method: cfg.method,
      headers: cfg.headers || {},
      redirect: "manual",
    };

    if (cfg.body && !["GET", "HEAD", "DELETE"].includes(cfg.method)) {
      opts.body = JSON.stringify(cfg.body);
    }

    const response = await fetch(cfg.url, opts);
    const ct = response.headers.get("content-type") || "";
    let responseBody;

    if (ct.includes("application/json")) {
      responseBody = await response.json();
    } else if (ct.includes("text/") || ct.includes("html")) {
      responseBody = await response.text();
    } else {
      const buf = await response.arrayBuffer();
      responseBody = Buffer.from(buf).toString("hex");
    }

    const responseHeaders = {};
    response.headers.forEach((v, k) => {
      responseHeaders[k] = v;
    });

    return res.json({
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
    });
  } catch (e) {
    return res
      .status(500)
      .json({ error: "Ошибка выполнения запроса: " + e.message });
  }
});

webserver.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
