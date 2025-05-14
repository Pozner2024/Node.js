import fs from "fs";
import { readdir, stat } from "fs/promises";
import path from "path";
import zlib from "zlib";
import readline from "readline";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "AutoCompressor> ",
});

console.log("Введите путь к папке (например: ./src/test-folder)");
rl.prompt();

rl.on("line", async (input) => {
  const folderPath = input.trim();

  if (!folderPath) {
    rl.close();
    return;
  }

  console.log(`🔍 Сканирование папки: ${folderPath}\n`);

  try {
    const files = await getAllFiles(folderPath);

    for (const file of files) {
      await compressFile(file);
    }

    console.log("🎉 Все файлы обработаны!\n");
  } catch (err) {
    console.error("❌ Ошибка:", err.message);
  }

  rl.prompt();
});

rl.on("close", () => {
  console.log("До свидания!");
});

// ===== ФУНКЦИИ =====

async function getAllFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });

  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return await getAllFiles(fullPath);
      } else {
        return fullPath;
      }
    })
  );

  return files.flat();
}

async function compressFile(filePath) {
  if (filePath.endsWith(".gz")) return;

  const gzFilePath = filePath + ".gz";

  try {
    const fileStat = await stat(filePath);
    let gzStat = null;

    try {
      gzStat = await stat(gzFilePath);
    } catch {
      // gz-файл не существует
    }

    let needCompress = false;

    if (!gzStat) {
      console.log(`🆕 Архив ${gzFilePath} не найден — создаётся...`);
      needCompress = true;
    } else if (fileStat.mtimeMs > gzStat.mtimeMs) {
      console.log(`🔁 Архив ${gzFilePath} устарел — пересоздаётся...`);
      needCompress = true;
    } else {
      console.log(`✅ Архив ${gzFilePath} актуален, пропуск.`);
    }

    if (needCompress) {
      await new Promise((resolve, reject) => {
        const readStream = fs.createReadStream(filePath);
        const writeStream = fs.createWriteStream(gzFilePath);
        const gzip = zlib.createGzip();

        console.log(`📦 Начато сжатие: ${filePath} → ${gzFilePath}`);

        readStream
          .pipe(gzip)
          .pipe(writeStream)
          .on("finish", () => {
            console.log(`✅ Готово: ${gzFilePath}\n`);
            resolve();
          })
          .on("error", (err) => {
            console.error(`❌ Ошибка при сжатии ${filePath}:`, err.message);
            reject(err);
          });
      });
    }
  } catch (err) {
    console.error(`❌ Ошибка при обработке ${filePath}:`, err.message);
  }
}
