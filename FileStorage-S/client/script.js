// Session management functions
function getSessionId() {
  return localStorage.getItem("sessionId");
}

function setSessionId(sessionId) {
  localStorage.setItem("sessionId", sessionId);
}

function clearSessionId() {
  localStorage.removeItem("sessionId");
}

function addSessionHeader(headers = {}) {
  const sessionId = getSessionId();
  if (sessionId) {
    headers["X-Session-ID"] = sessionId;
  }
  return headers;
}

async function fetchWithSession(url, options = {}) {
  const headers = addSessionHeader(options.headers || {});
  const response = await fetch(url, { ...options, headers });

  // If response contains new sessionId, save it
  const newSessionId = response.headers.get("X-Session-ID");
  if (newSessionId) {
    setSessionId(newSessionId);
  }

  return response;
}

// Auth functions
async function login(email, password) {
  try {
    const response = await fetchWithSession("/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error("Login failed");
    }

    return await response.json();
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
}

async function logout() {
  try {
    await fetchWithSession("/logout", {
      method: "POST",
    });
    clearSessionId();
  } catch (error) {
    console.error("Logout error:", error);
    throw error;
  }
}

async function checkAuth() {
  try {
    const response = await fetchWithSession("/whoami");
    if (!response.ok) {
      throw new Error("Not authenticated");
    }
    return await response.json();
  } catch (error) {
    console.error("Auth check error:", error);
    throw error;
  }
}

const form = document.getElementById("uploadForm");
const fileInput = document.getElementById("fileInput");
const fileNameDisplay = document.getElementById("fileNameDisplay");
const commentInput = document.getElementById("comment");
const status = document.getElementById("status");
const progressContainer = document.getElementById("progress-container");
const progressBar = document.getElementById("progress-bar");
const fileListEl = document.getElementById("fileList");
const usernameDisplay = document.getElementById("username-display");
const headerTitle = document.getElementById("header-title");

// Функция для проверки, авторизован ли пользователь, и установки login
async function initUser() {
  if (!usernameDisplay) return;
  try {
    const data = await checkAuth();
    const login = data.username;
    // Вставляем login на страницу
    usernameDisplay.textContent = login;
    // Обновляем заголовок страницы
    document.title = `FileStorage`;
    headerTitle.textContent = `FileStorage`;
  } catch (err) {
    // Если неавторизован → сразу на / (login.html)
    window.location.href = "/";
  }
}

// === 0) При загрузке DOM проверяем, авторизован ли пользователь ===
window.addEventListener("DOMContentLoaded", () => {
  initUser().then(() => {
    // Только после того, как проверили авторизацию, запускаем загрузку списка файлов
    if (fileListEl) {
      loadFileList();
    }
  });
});

// === 1) Показываем имя выбранного файла в UI ===
if (fileInput && fileNameDisplay) {
  fileInput.addEventListener("change", () => {
    fileNameDisplay.textContent = fileInput.files[0]
      ? fileInput.files[0].name
      : "";
  });
}

// === 2) Загружаем список файлов и строим HTML-UI ===
async function loadFileList() {
  try {
    const res = await fetchWithSession("/files");
    if (!res.ok) {
      throw new Error("Ошибка при получении списка файлов");
    }
    const files = await res.json();
    fileListEl.innerHTML = "";

    files.forEach(({ filename, originalname, comment }) => {
      const li = document.createElement("li");

      const div = document.createElement("div");
      const link = document.createElement("a");
      link.href = `/download/${encodeURIComponent(filename)}`;
      link.setAttribute("download", originalname);
      link.textContent = `📥 ${originalname}`;
      div.appendChild(link);

      if (comment) {
        const span = document.createElement("span");
        span.className = "file-comment";
        span.textContent = comment;
        div.appendChild(span);
      }

      const delBtn = document.createElement("button");
      delBtn.className = "delete-btn";
      delBtn.dataset.filename = filename;
      delBtn.textContent = "🗑️ Удалить";
      delBtn.onclick = async () => {
        const fn = delBtn.dataset.filename;
        if (!confirm(`Удалить файл «${originalname}»?`)) return;
        try {
          const resp = await fetch(`/files/${encodeURIComponent(fn)}`, {
            method: "DELETE",
          });
          if (resp.ok) {
            loadFileList();
          } else {
            alert("Ошибка при удалении файла");
          }
        } catch {
          alert("Ошибка при удалении файла");
        }
      };

      li.appendChild(div);
      li.appendChild(delBtn);
      fileListEl.appendChild(li);
    });
  } catch (e) {
    console.error(e);
  }
}

// === 3) Обработка загрузки файла: WebSocket + fetch("/upload") ===
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const file = fileInput.files[0];
    const comment = commentInput.value.trim();
    if (!file || !comment) {
      alert("Выберите файл и введите комментарий");
      return;
    }

    // Генерируем уникальный uploadId
    const uploadId =
      Date.now().toString() + Math.random().toString(36).substr(2);

    // Показываем прогресс-бар
    progressBar.value = 0;
    progressContainer.classList.remove("hidden");
    status.textContent = "⏳ Загрузка...";

    // Собираем FormData и отправляем файл
    const fd = new FormData();
    fd.append("file", file);
    fd.append("comment", comment);

    try {
      // Открываем WebSocket для прогресса
      const wsProtocol = location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(
        `${wsProtocol}://${location.hostname}:3001/?uploadId=${uploadId}`
      );

      ws.addEventListener("message", (evt) => {
        const data = JSON.parse(evt.data);
        if (data.progress != null) {
          progressBar.value = data.progress;
          status.textContent = `Загрузка: ${data.progress}%`;
          if (data.progress >= 100) {
            setTimeout(() => {
              progressContainer.classList.add("hidden");
              ws.close();
            }, 200);
          }
        }
      });

      ws.addEventListener("error", () => {
        console.error("WebSocket error");
      });

      ws.addEventListener("open", async () => {
        try {
          const res = await fetchWithSession("/upload", {
            method: "POST",
            headers: {
              "X-Upload-Id": uploadId,
            },
            body: fd,
          });

          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Ошибка при загрузке файла");
          }

          const data = await res.json();
          status.textContent = `✅ Успешно: ${data.originalname}`;
          form.reset();
          fileNameDisplay.textContent = "";
          loadFileList();
        } catch (err) {
          status.textContent = `❌ Ошибка: ${err.message}`;
          ws.close();
        }
      });

      ws.addEventListener("close", () => {
        progressContainer.classList.add("hidden");
      });
    } catch (err) {
      status.textContent = `❌ Ошибка: ${err.message}`;
      progressContainer.classList.add("hidden");
    }
  });
}
