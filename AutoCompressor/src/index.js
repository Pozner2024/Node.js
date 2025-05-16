import fs from "fs";
import { readdir, stat } from "fs/promises";
import path from "path";
import zlib from "zlib";
import readline from "readline";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Интерфейс командной строки
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "AutoCompressor> ",
});

console.log("Введите путь к папке (например: ../test-folder)");
rl.prompt();

rl.on("line", async (input) => {
  const folderPath = input.trim();

  if (!folderPath) {
    rl.close();
    return;
  }

  console.log(`[INFO] Захожу в папку: ${folderPath}\n`);

  try {
    const files = await getAllFiles(folderPath);

    for (const file of files) {
      console.log(`[INFO] Нашёл файл: ${file}`);
      await compressFile(file);
    }

    console.log("\n[OK] Все файлы обработаны!\n");
  } catch (err) {
    console.error(`[ERROR] Ошибка: ${err.message}`);
  }

  rl.prompt();
});

rl.on("close", () => {
  console.log("До свидания!");
});

// ===== ФУНКЦИИ =====

async function getAllFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      console.log(`[INFO] Захожу в подпапку: ${fullPath}`);
      const nestedFiles = await getAllFiles(fullPath); // рекурсия
      files.push(...nestedFiles);
    } else {
      if (!entry.name.endsWith(".gz")) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

async function compressFile(filePath) {
  const gzFilePath = filePath + ".gz";

  try {
    const sourceInfo = await stat(filePath);
    let archiveInfo;

    try {
      archiveInfo = await stat(gzFilePath);
    } catch {}

    const archiveMissing = !archiveInfo;
    const archiveOutdated =
      archiveInfo && sourceInfo.mtimeMs > archiveInfo.mtimeMs;

    if (!archiveMissing && !archiveOutdated) {
      console.log(`[OK] ZIP версия актуальна: ${gzFilePath}`);
      return;
    }

    if (archiveMissing) {
      console.log(`[NEW] ZIP версии нет — создаю: ${gzFilePath}`);
    } else {
      console.log(`[UPDATE] ZIP версия устарела — пересоздаю: ${gzFilePath}`);
    }

    await compressWithStreams(filePath, gzFilePath);
    console.log(`[OK] Готово: ${gzFilePath}\n`);
  } catch (err) {
    console.error(`[ERROR] Ошибка с файлом ${filePath}: ${err.message}`);
  }
}

function compressWithStreams(sourcePath, destPath) {
  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(sourcePath);
    const gzip = zlib.createGzip();
    const writeStream = fs.createWriteStream(destPath);

    readStream.on("error", reject);
    gzip.on("error", reject);
    writeStream.on("error", reject);

    writeStream.on("finish", resolve);

    readStream.pipe(gzip).pipe(writeStream);
  });
}
