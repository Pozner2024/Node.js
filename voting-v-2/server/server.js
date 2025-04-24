const express = require("express");
const fs = require("fs");
const path = require("path");

const webserver = express();
const PORT = 80;

// Парсинг JSON-тела
webserver.use(express.json());

// Раздаём все файлы из client/public
webserver.use(express.static(path.join(__dirname, "..", "client", "public")));

// Путь к JSON-файлу
const votesFilePath = path.join(__dirname, "votes.json");

// Получение вариантов
webserver.get("/variants", (req, res) => {
  fs.readFile(votesFilePath, "utf8", (err, data) => {
    if (err) return res.status(500).json({ error: "Ошибка чтения файла" });
    const json = JSON.parse(data);
    const response = {
      question: json.question,
      answers: json.answers.map(({ id, text }) => ({ id, text })),
    };
    res.json(response);
  });
});

// Получение статистики
webserver.post("/stat", (req, res) => {
  fs.readFile(votesFilePath, "utf8", (err, data) => {
    if (err) return res.status(500).json({ error: "Ошибка чтения файла" });
    const json = JSON.parse(data);
    const stat = {};
    json.answers.forEach((ans) => {
      stat[ans.id] = ans.votes;
    });
    res.json(stat);
  });
});

// Приём голосов
webserver.post("/vote", (req, res) => {
  const { voteId } = req.body;
  if (!voteId) return res.status(400).json({ error: "Нет voteId" });

  fs.readFile(votesFilePath, "utf8", (err, data) => {
    if (err) return res.status(500).json({ error: "Ошибка чтения файла" });

    const json = JSON.parse(data);
    const answer = json.answers.find((a) => a.id === voteId);
    if (!answer) return res.status(400).json({ error: "Неверный voteId" });

    answer.votes++;

    fs.writeFile(votesFilePath, JSON.stringify(json, null, 2), (err) => {
      if (err) return res.status(500).json({ error: "Ошибка записи файла" });

      const result = {};
      json.answers.forEach((ans) => {
        result[ans.id] = ans.votes;
      });
      res.json({ success: true, votes: result });
    });
  });
});

//загрузка данных
webserver.get("/download", (req, res) => {
  fs.readFile(votesFilePath, "utf8", (err, data) => {
    if (err) return res.status(500).send("Ошибка чтения файла");

    const json = JSON.parse(data);
    const stat = {};
    json.answers.forEach((ans) => {
      stat[ans.id] = ans.votes;
    });

    const accept = req.headers.accept;

    if (accept.includes("application/json")) {
      res.setHeader("Content-Disposition", "attachment; filename=stats.json");
      res.json(stat);
    } else if (accept.includes("application/xml")) {
      const xml = `
        <statistics>
          <brave-men>${stat[1]}</brave-men>
          <cowards>${stat[2]}</cowards>
          <introverts>${stat[3]}</introverts>
        </statistics>
      `.trim();
      res.setHeader("Content-Type", "application/xml");
      res.setHeader("Content-Disposition", "attachment; filename=stats.xml");
      res.send(xml);
    } else if (accept.includes("text/html")) {
      const html = `
        <html><body>
          <h2>Voting Results</h2>
          <p>Brave men: ${stat[1]}</p>
          <p>Cowards: ${stat[2]}</p>
          <p>Introverts: ${stat[3]}</p>
        </body></html>
      `.trim();
      res.setHeader("Content-Type", "text/html");
      res.setHeader("Content-Disposition", "attachment; filename=stats.html");
      res.send(html);
    } else {
      res.status(406).send("Not Acceptable");
    }
  });
});

// Fallback: отдаём index.html для всех неизвестных маршрутов
webserver.use((req, res) => {
  res.sendFile(path.join(__dirname, "..", "client", "public", "index.html"));
});
// Запуск сервера
webserver.listen(PORT, () => {
  console.log(`The server is running on http://localhost:${PORT}`);
});
