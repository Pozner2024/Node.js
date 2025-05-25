const form = document.getElementById("uploadForm");
const fileInput = document.getElementById("fileInput");
const fileNameDisplay = document.getElementById("fileNameDisplay");
const commentInput = document.getElementById("comment");
const status = document.getElementById("status");
const progressContainer = document.getElementById("progress-container");
const progressBar = document.getElementById("progress-bar");
const fileListEl = document.getElementById("fileList");

// Показываем имя файла рядом с кнопкой
fileInput.addEventListener("change", () => {
  fileNameDisplay.textContent = fileInput.files[0]
    ? fileInput.files[0].name
    : "";
});

// WebSocket соединение
const wsProtocol = location.protocol === "https:" ? "wss" : "ws";
const ws = new WebSocket(`${wsProtocol}://${location.hostname}:3001`);
ws.addEventListener("message", (evt) => {
  const data = JSON.parse(evt.data);
  if (data.progress != null) {
    progressBar.value = data.progress;
    status.textContent = `Загрузка: ${data.progress}%`;
    if (data.progress >= 100) {
      setTimeout(() => {
        progressContainer.classList.add("hidden");
        alert("Готово");
      }, 200);
    }
  }
});
ws.addEventListener("error", () => {
  status.textContent = "⚠️ Ошибка WebSocket";
  ws.close();
});
ws.addEventListener("close", () => {
  status.textContent = "🔌 WebSocket отключён";
});

// Загрузка списка файлов
async function loadFileList() {
  try {
    const res = await fetch("/files");
    const files = await res.json();
    fileListEl.innerHTML = files
      .map(
        ({ filename, originalname, comment }) => `
      <li>
        <div>
          <a href="/download/${encodeURIComponent(filename)}"
             download="${originalname}">
            📥 ${originalname}
          </a>
          ${comment ? `<span class="file-comment">${comment}</span>` : ""}
        </div>
        <button class="delete-btn" data-filename="${filename}">
          🗑️ Удалить
        </button>
      </li>`
      )
      .join("");

    document.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.onclick = async () => {
        const fn = btn.dataset.filename;
        if (!confirm(`Удалить файл «${fn}»?`)) return;
        try {
          const resp = await fetch(`/files/${encodeURIComponent(fn)}`, {
            method: "DELETE",
          });
          if (resp.ok) loadFileList();
          else alert("Ошибка при удалении");
        } catch {
          alert("Ошибка при удалении");
        }
      };
    });
  } catch (e) {
    console.error(e);
  }
}

// Обработка отправки формы
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  progressBar.value = 0;
  progressContainer.classList.remove("hidden");
  status.textContent = "⏳ Загрузка...";

  const file = fileInput.files[0];
  const comment = commentInput.value;
  if (!file || !comment) return;

  const fd = new FormData();
  fd.append("file", file);
  fd.append("comment", comment);

  try {
    const res = await fetch("/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (res.ok) {
      status.textContent = `✅ Загружено: ${data.originalname}`;
      form.reset();
      fileNameDisplay.textContent = "";
      loadFileList();
    } else {
      status.textContent = `❌ Ошибка: ${data.error}`;
    }
  } catch {
    status.textContent = "❌ Ошибка при отправке.";
  }
});

window.addEventListener("load", loadFileList);
