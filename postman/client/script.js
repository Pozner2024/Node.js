const form = document.getElementById("requestForm");
const methodSelect = document.getElementById("method");
const bodyBlock = document.getElementById("requestBody");
const requestIdInput = document.getElementById("requestId");
const addHeaderBtn = document.getElementById("addHeaderBtn");

// Предотвращаем реальный сабмит
form.addEventListener("submit", (e) => e.preventDefault());

// Показ/скрытие блока body
methodSelect.addEventListener("change", (e) => {
  bodyBlock.style.display = ["POST", "PUT", "PATCH"].includes(e.target.value)
    ? "flex"
    : "none";
});

// Добавление/удаление заголовков
addHeaderBtn.addEventListener("click", () => {
  const row = document.createElement("div");
  row.classList.add("header-row");

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.placeholder = "Header Name";
  nameInput.classList.add("hdr-name");

  const valueInput = document.createElement("input");
  valueInput.type = "text";
  valueInput.placeholder = "Header Value";
  valueInput.classList.add("hdr-value");

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.textContent = "×";
  removeBtn.addEventListener("click", () => row.remove());

  row.append(nameInput, valueInput, removeBtn);
  document.getElementById("headerRows").appendChild(row);
});

function collectHeaders() {
  const headers = {};
  for (const row of document.querySelectorAll("#headerRows .header-row")) {
    const name = row.querySelector(".hdr-name").value.trim();
    const value = row.querySelector(".hdr-value").value.trim();
    if (!name && !value) continue;
    if (!name) {
      alert("Название заголовка не может быть пустым");
      return null;
    }
    if (!/^[A-Za-z][A-Za-z0-9-]*$/.test(name)) {
      alert(`Недопустимое имя заголовка: "${name}"`);
      return null;
    }
    if (/[\r\n]/.test(value)) {
      alert("Недопустимое значение заголовка");
      return null;
    }
    headers[name] = value;
  }
  return headers;
}

function validateURL(str) {
  try {
    const u = new URL(str);
    return ["http:", "https:"].includes(u.protocol);
  } catch {
    return false;
  }
}

function renderResponse(result) {
  const box = document.getElementById("responseBox");
  box.style.display = "block";
  box.innerHTML = "";
  if (result.error) {
    box.textContent = "Ошибка: " + result.error;
    return;
  }

  const ct = (result.headers?.["content-type"] || "").toLowerCase();
  box.innerHTML = `
    <p><strong>Статус:</strong> ${result.status} ${result.statusText}</p>
    <p><strong>Content-Type:</strong> ${ct}</p>
    <strong>Заголовки:</strong>
    <pre>${Object.entries(result.headers || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n")}</pre>
    <strong>Тело:</strong>
  `;

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
    const hex = result.body;
    const bytes = new Uint8Array(
      hex.match(/.{1,2}/g).map((b) => parseInt(b, 16))
    );
    const blob = new Blob([bytes], { type: ct });
    const img = document.createElement("img");
    img.src = URL.createObjectURL(blob);
    box.appendChild(img);
  } else {
    const pre = document.createElement("pre");
    pre.textContent = result.body;
    box.appendChild(pre);
  }
}

async function loadSavedRequests() {
  const res = await fetch("/saved-requests-html");
  const html = await res.text();
  const container = document.getElementById("savedRequests");
  container.innerHTML = html;

  container.querySelectorAll(".request-item").forEach((el) => {
    el.addEventListener("click", async () => {
      const index = el.dataset.index;
      const res = await fetch("/proxy");
      const list = await res.json();
      const r = list[index];

      requestIdInput.value = index;
      methodSelect.value = r.method;
      document.getElementById("url").value = r.url;
      bodyBlock.style.display = ["POST", "PUT", "PATCH"].includes(r.method)
        ? "flex"
        : "none";
      document.getElementById("body").value = r.body
        ? JSON.stringify(r.body, null, 2)
        : "";
      document.getElementById("headerRows").innerHTML = "";
      if (r.headers) {
        Object.entries(r.headers).forEach(([k, v]) => {
          addHeaderBtn.click();
          const last = document.querySelector(
            "#headerRows .header-row:last-child"
          );
          last.querySelector(".hdr-name").value = k;
          last.querySelector(".hdr-value").value = v;
        });
      }
    });
  });
}

async function saveRequest() {
  const method = methodSelect.value;
  const url = document.getElementById("url").value.trim();
  if (!validateURL(url)) {
    alert("Неверный URL");
    return;
  }

  const headers = collectHeaders();
  if (headers === null) return;
  if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";

  const bodyText = document.getElementById("body").value.trim();
  const payload = { method, url, headers };
  const id = Number(requestIdInput.value);

  if (["POST", "PUT", "PATCH"].includes(method) && bodyText) {
    try {
      payload.body = JSON.parse(bodyText);
    } catch {
      alert("Неверный JSON");
      return;
    }
  }

  if (id) {
    alert("Этот запрос уже сохранён");
    return;
  }

  const resp = await fetch("/proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const result = await resp.json();
  if (resp.ok) {
    alert(result.message || "Сохранено");
    loadSavedRequests();
  } else {
    alert("Ошибка: " + (result.error || resp.statusText));
  }
}

async function runRequest() {
  const url = document.getElementById("url").value.trim();
  if (!validateURL(url)) {
    alert("Неверный URL");
    return;
  }

  const headers = collectHeaders();
  if (headers === null) return;
  if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";

  const bodyText = document.getElementById("body").value.trim();
  const id = Number(requestIdInput.value);

  if (id) {
    const resp = await fetch("/proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isExecution: true, id }),
    });
    renderResponse(await resp.json());
    return;
  }

  const method = methodSelect.value;
  const payload = { method, url, headers, isExecution: true };
  if (["POST", "PUT", "PATCH"].includes(method) && bodyText) {
    try {
      payload.body = JSON.parse(bodyText);
    } catch {
      alert("Неверный JSON");
      return;
    }
  }

  const resp = await fetch("/proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  renderResponse(await resp.json());
}

document.getElementById("saveBtn").addEventListener("click", saveRequest);
document.getElementById("runBtn").addEventListener("click", runRequest);

form.addEventListener("reset", () => {
  requestIdInput.value = "";
  bodyBlock.style.display = "none";
  document.getElementById("headerRows").innerHTML = "";
  document.getElementById("body").value = "";
  document.getElementById("responseBox").style.display = "none";
});

loadSavedRequests();
