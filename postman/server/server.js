const express = require("express");
const fs = require("fs");
const path = require("path");

const webserver = express();
const PORT = 3000;

const DATA_PATH = path.join(__dirname, "postman_data.json");
const CLIENT_PATH = path.join(__dirname, "..", "client");

webserver.use(express.json());
webserver.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS" && req.path === "/proxy") {
    return res.sendStatus(204);
  }
  next();
});

webserver.use("/", express.static(CLIENT_PATH));

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

// POST /proxy — три сценария:
// 1) isExecution — выполнить запрос «на лету»
// 2) index — выполнить сохранённый по индексу
// 3) иначе — сохранить новый
webserver.post("/proxy", async (req, res) => {
  const { isExecution, index, method, url, headers, body } = req.body;

  // Ветка 1: «на лету»
  if (isExecution) {
    try {
      const opts = {
        method,
        headers: headers || {},
        redirect: "manual",
      };
      if (body != null && !["GET", "HEAD", "DELETE"].includes(method)) {
        opts.body = JSON.stringify(body);
      }

      const response = await fetch(url, opts);
      const ct = response.headers.get("content-type") || "";

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        return res.json({
          status: response.status,
          statusText: response.statusText,
          headers: { location },
          body: null,
        });
      }

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
  }

  // Ветка 2: выполнить сохранённый запрос по индексу
  if (typeof index === "number") {
    try {
      const list = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
      const cfg = list[index];
      if (!cfg) {
        return res.status(404).json({ error: "Запрос не найден" });
      }

      const opts = {
        method: cfg.method,
        headers: cfg.headers || {},
        redirect: "manual",
      };
      if (cfg.body != null && !["GET", "HEAD", "DELETE"].includes(cfg.method)) {
        opts.body = JSON.stringify(cfg.body);
      }

      const response = await fetch(cfg.url, opts);
      const ct = response.headers.get("content-type") || "";

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        return res.json({
          status: response.status,
          statusText: response.statusText,
          headers: { location },
          body: null,
        });
      }

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
      return res.status(500).json({
        error: "Ошибка выполнения сохранённого запроса: " + e.message,
      });
    }
  }

  // Ветка 3: сохранение нового запроса
  const newReq = { method, url, headers, body };
  fs.readFile(DATA_PATH, "utf8", (err, data) => {
    const list = err ? [] : JSON.parse(data);
    list.push(newReq);
    fs.writeFile(DATA_PATH, JSON.stringify(list, null, 2), (err) => {
      if (err) return res.status(500).json({ error: "Ошибка сохранения" });
      res.status(201).json({ message: "Сохранено" });
    });
  });
});

webserver.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
