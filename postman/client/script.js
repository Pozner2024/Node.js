// Предотвращаем дефолтный submit формы
document
  .getElementById("requestForm")
  .addEventListener("submit", (e) => e.preventDefault());

// Показывать textarea только для POST/PUT
document.getElementById("method").addEventListener("change", (e) => {
  document.getElementById("requestBody").style.display = [
    "POST",
    "PUT",
    "PATCH",
  ].includes(e.target.value)
    ? "flex"
    : "none";
});

document.getElementById("saveBtn").addEventListener("click", saveRequest);
document.getElementById("runBtn").addEventListener("click", runRequest);

// Проверка валидности URL
function validateURL(str) {
  try {
    const url = new URL(str);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }
    const hostPattern = /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i;
    if (!hostPattern.test(url.hostname)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function loadSavedRequests() {
  const res = await fetch("/proxy");
  const list = await res.json();
  const container = document.getElementById("savedRequests");
  container.innerHTML = "";
  list.forEach((r, i) => {
    const div = document.createElement("div");
    div.className = "request-item";
    div.innerHTML = `Метод: ${r.method}<br>${r.url}`;
    div.addEventListener("click", () => {
      document.getElementById("method").value = r.method;
      document.getElementById("url").value = r.url;
      document.getElementById("requestBody").style.display = [
        "POST",
        "PUT",
      ].includes(r.method)
        ? "flex"
        : "none";
      document.getElementById("body").value = r.body
        ? JSON.stringify(r.body, null, 2)
        : "";
    });
    container.appendChild(div);
  });
}

async function runRequest() {
  // 1) Сбор данных
  const method = document.getElementById("method").value;
  const rawUrl = document.getElementById("url").value.trim();
  if (!validateURL(rawUrl)) {
    alert("Неверный URL: " + rawUrl);
    return;
  }
  const url = rawUrl;
  let body = document.getElementById("body").value;

  // 2) Формируем данные для прокси
  const requestData = {
    method,
    url,
    isExecution: true,
    headers: { "Content-Type": "application/json" },
  };
  if (["POST", "PUT", "PATCH"].includes(method) && body) {
    try {
      requestData.body = JSON.parse(body);
    } catch {
      alert("Ошибка в JSON-теле");
      return;
    }
  }

  // 3) Отправляем на сервер
  const res = await fetch("/proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestData),
  });
  const result = await res.json();
  const box = document.getElementById("responseBox");
  box.style.display = "block";

  if (result.error) {
    box.textContent = "Ошибка: " + result.error;
    return;
  }

  // 4) Отрисовка ответа
  const ct = (result.headers?.["content-type"] || "").toLowerCase();
  const hdrs = Object.entries(result.headers || {})
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  box.innerHTML = `
<strong>Статус:</strong> ${result.status} ${result.statusText}<br>
<strong>Content-Type:</strong> ${ct}<br>
<strong>Заголовки:</strong><pre>${hdrs}</pre>
<strong>Тело:</strong>`;

  if (ct.includes("text/html")) {
    const iframe = document.createElement("iframe");
    iframe.srcdoc = result.body;
    box.appendChild(iframe);
  } else if (ct.includes("application/json")) {
    const pre = document.createElement("pre");
    pre.textContent = JSON.stringify(result.body, null, 2);
    box.appendChild(pre);
  } else if (ct.startsWith("text/")) {
    const pre = document.createElement("pre");
    pre.textContent = result.body;
    box.appendChild(pre);
  } else if (ct.startsWith("image/")) {
    // Показываем картинку, декодируя hex
    const hex = result.body;
    const bytes = new Uint8Array(
      hex.match(/.{1,2}/g).map((b) => parseInt(b, 16))
    );
    const blob = new Blob([bytes], { type: ct });
    const imgUrl = URL.createObjectURL(blob);
    const img = document.createElement("img");
    img.src = imgUrl;
    box.appendChild(img);
  } else {
    // Прочий бинарь — выводим hex
    const pre = document.createElement("pre");
    pre.textContent = result.body;
    box.appendChild(pre);
  }
}

async function saveRequest() {
  const method = document.getElementById("method").value;
  const rawUrl = document.getElementById("url").value.trim();
  if (!validateURL(rawUrl)) {
    alert("Неверный URL: " + rawUrl);
    return;
  }
  const url = rawUrl;
  let body = document.getElementById("body").value;

  // Проверка дубликата
  const res = await fetch("/proxy");
  const saved = await res.json();
  if (saved.find((r) => r.url === url && r.method === method)) {
    alert("Этот запрос уже сохранён");
    return;
  }

  // Сохраняем
  const requestData = {
    method,
    url,
    headers: { "Content-Type": "application/json" },
  };
  if (["POST", "PUT"].includes(method) && body) {
    try {
      requestData.body = JSON.parse(body);
    } catch {
      alert("Ошибка в JSON-теле");
      return;
    }
  }

  const saveRes = await fetch("/proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestData),
  });
  const result = await saveRes.json();
  if (saveRes.ok) {
    alert(result.message || "Сохранено");
    loadSavedRequests();
  } else {
    alert("Ошибка: " + (result.error || saveRes.statusText));
  }
}

window.onload = loadSavedRequests;
