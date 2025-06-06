import express from "express";
import mysql from "mysql2/promise";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// создаём пул соединений
const pool = mysql.createPool({
  socketPath: "/var/run/mysqld/mysqld.sock",
  user: "root",
  database: "learning_db",
  waitForConnections: true,
  connectionLimit: 10,
});

const webServer = express();
webServer.use(express.json());
webServer.use(express.static(path.join(__dirname, "../client")));

// Обработка POST /query — выполняем любой SQL
webServer.post("/query", async (req, res) => {
  const sql = (req.body.sql || "").trim();
  try {
    const [rows, fields] = await pool.query(sql);
    const cmd = sql.split(/\s+/)[0].toLowerCase();

    // команды, выводящие табличный результат
    const tableCmds = ["select", "show", "describe", "desc"];
    if (tableCmds.includes(cmd)) {
      return res.json({
        type: "select",
        columns: fields.map((f) => f.name),
        rows: rows,
      });
    }

    // все остальные — модифицирующие запросы
    return res.json({
      type: "modify",
      rowCount: rows.affectedRows,
    });
  } catch (err) {
    // при ошибке возвращаем текст ошибки
    return res.json({
      type: "error",
      message: err.message,
    });
  }
});

const PORT = 80;
webServer.listen(PORT, () => {
  console.log(`WebServer listening on http://localhost:${PORT}`);
});
