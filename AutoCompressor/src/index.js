import fs from "fs";
import { readdir, stat } from "fs/promises";
import path from "path";
import zlib from "zlib";
import readline from "readline";
import { fileURLToPath } from "url";
import chalk from "chalk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Интерфейс командной строки
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: chalk.cyan(
    "💾 AutoCompressor. Введите путь к папке (например: ../test-folder)> "
  ),
});

console.log(chalk.greenBright("✅ AutoCompressor запущен!\n"));
rl.prompt();

rl.on("line", async (input) => {
  const folderPath = input.trim();

  if (!folderPath) {
    rl.close();
    return;
  }

  console.log(chalk.blue(`[INFO] Захожу в папку: ${folderPath}\n`));

  try {
    const files = await getAllFiles(folderPath);

    for (const file of files) {
      console.log(chalk.blue(`[INFO] Нашёл файл: ${file}`));
      await compressFile(file);
    }

    console.log(chalk.greenBright("\n[OK] Все файлы обработаны!\n"));
  } catch (err) {
    console.error(chalk.red.bold(`[ERROR] Ошибка: ${err.message}`));
  }

  rl.prompt();
});

rl.on("close", () => {
  console.log(chalk.green("👋 До свидания!"));
});

// ===== ФУНКЦИИ =====

async function getAllFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      console.log(chalk.blue(`[INFO] Захожу в подпапку: ${fullPath}`));
      const nestedFiles = await getAllFiles(fullPath);
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
      console.log(
        chalk.greenBright(`[OK] ZIP версия актуальна: ${gzFilePath}`)
      );
      return;
    }

    if (archiveMissing) {
      console.log(chalk.yellow(`[NEW] ZIP версии нет — создаю: ${gzFilePath}`));
    } else {
      console.log(
        chalk.red(`[UPDATE] ZIP версия устарела — пересоздаю: ${gzFilePath}`)
      );
    }

    await compressWithStreams(filePath, gzFilePath);
    console.log(chalk.green(`[OK] Готово: ${gzFilePath}\n`));
  } catch (err) {
    console.error(
      chalk.red.bold(`[ERROR] Ошибка с файлом ${filePath}: ${err.message}`)
    );
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
