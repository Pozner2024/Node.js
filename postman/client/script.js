const form = document.getElementById("requestForm");
form.addEventListener("submit", (e) => e.preventDefault());

const methodSelect = document.getElementById("method");
const bodyBlock = document.getElementById("requestBody");
methodSelect.addEventListener("change", (e) => {
  bodyBlock.style.display = ["POST", "PUT", "PATCH"].includes(e.target.value)
    ? "flex"
    : "none";
});

// Добавление/удаление заголовков
const addHeaderBtn = document.getElementById("addHeaderBtn");
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
  removeBtn.classList.add("remove-hdr");
  removeBtn.textContent = "×";
  removeBtn.addEventListener("click", () => row.remove());

  row.appendChild(nameInput);
  row.appendChild(valueInput);
  row.appendChild(removeBtn);

  document.getElementById("headerRows").appendChild(row);
});

function collectHeaders() {
  const headers = {};
  const rows = document.querySelectorAll("#headerRows .header-row");

  const isValidName = (name) => /^[A-Za-z][A-Za-z0-9-]*$/.test(name);
  const isValidValue = (value) => !/[\r\n]/.test(value);

  for (const row of rows) {
    const name = row.querySelector(".hdr-name").value.trim();
    const value = row.querySelector(".hdr-value").value.trim();

    if (!name && !value) continue;

    if (!name) {
      alert("Название заголовка не может быть пустым");
      return null;
    }

    if (!isValidName(name)) {
      alert(
        `Недопустимое имя заголовка: "${name}". Имя должно начинаться с буквы и содержать только буквы, цифры или дефисы.`
      );
      return null;
    }

    if (!isValidValue(value)) {
      alert("Недопустимое значение заголовка (содержит перенос строки)");
      return null;
    }

    headers[name] = value;
  }

  return headers;
}

// Проверка валидности URL
function validateURL(str) {
  try {
    const url = new URL(str);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(url.hostname)
    );
  } catch {
    return false;
  }
}

// Загрузка сохранённых запросов
async function loadSavedRequests() {
  const res = await fetch("/proxy");
  const list = await res.json();
  const container = document.getElementById("savedRequests");
  container.innerHTML = "";

  list.forEach((r, i) => {
    const div = document.createElement("div");
    div.className = "request-item";
    div.textContent = `${r.method} ${r.url}`;

    // клик — загружаем в форму
    div.addEventListener("click", () => {
      methodSelect.value = r.method;
      document.getElementById("url").value = r.url;
      bodyBlock.style.display = ["POST", "PUT", "PATCH"].includes(r.method)
        ? "flex"
        : "none";
      document.getElementById("body").value = r.body
        ? JSON.stringify(r.body, null, 2)
        : "";
      const headerRows = document.getElementById("headerRows");
      headerRows.innerHTML = "";
      if (r.headers) {
        Object.entries(r.headers).forEach(([k, v]) => {
          addHeaderBtn.click();
          const last = headerRows.querySelector(".header-row:last-child");
          last.querySelector(".hdr-name").value = k;
          last.querySelector(".hdr-value").value = v;
        });
      }
    });

    container.appendChild(div);
  });
}

// Отрисовка ответа
function renderResponse(result) {
  const box = document.getElementById("responseBox");
  box.style.display = "block";
  box.innerHTML = "";
  if (result.error) {
    box.textContent = "Ошибка: " + result.error;
    return;
  }

  const ct = (result.headers?.["content-type"] || "").toLowerCase();
  const hdrs = Object.entries(result.headers || {})
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  const statusPara = document.createElement("p");
  const statusLabel = document.createElement("strong");
  statusLabel.textContent = "Статус: ";
  statusPara.appendChild(statusLabel);
  statusPara.append(`${result.status} ${result.statusText}`);

  const ctPara = document.createElement("p");
  const ctLabel = document.createElement("strong");
  ctLabel.textContent = "Content-Type: ";
  ctPara.appendChild(ctLabel);
  ctPara.append(ct);

  const hdrsLabel = document.createElement("strong");
  hdrsLabel.textContent = "Заголовки:";

  const hdrsPre = document.createElement("pre");
  hdrsPre.textContent = hdrs;

  const bodyLabel = document.createElement("strong");
  bodyLabel.textContent = "Тело:";

  box.appendChild(statusPara);
  box.appendChild(ctPara);
  box.appendChild(hdrsLabel);
  box.appendChild(hdrsPre);
  box.appendChild(bodyLabel);

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

// Сохранение запроса
async function saveRequest() {
  const method = methodSelect.value;
  const urlInput = document.getElementById("url");
  const url = urlInput.value.trim();

  if (!validateURL(url)) {
    alert("Неверный URL: " + url);
    return;
  }

  const headers = collectHeaders();
  if (headers === null) return;

  if (!headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const bodyTextarea = document.getElementById("body");
  const bodyText = bodyTextarea.value;

  const response = await fetch("/proxy");
  const savedRequests = await response.json();

  const alreadySaved = savedRequests.find(
    (r) => r.url === url && r.method === method
  );
  if (alreadySaved) {
    alert("Этот запрос уже сохранён");
    return;
  }

  const requestToSave = { method, url, headers };
  const methodsWithBody = ["POST", "PUT"];
  if (methodsWithBody.includes(method) && bodyText.trim() !== "") {
    try {
      requestToSave.body = JSON.parse(bodyText);
    } catch {
      alert("Ошибка в JSON-теле");
      return;
    }
  }

  const saveResponse = await fetch("/proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestToSave),
  });
  const saveResult = await saveResponse.json();
  if (saveResponse.ok) {
    alert(saveResult.message || "Сохранено");
    loadSavedRequests();
  } else {
    alert("Ошибка: " + (saveResult.error || saveResponse.statusText));
  }
}

// Отправка custom-запроса
async function runRequest() {
  const method = methodSelect.value;
  const urlInput = document.getElementById("url");
  const url = urlInput.value.trim();

  if (!validateURL(url)) {
    alert("Неверный URL: " + url);
    return;
  }

  const headers = collectHeaders();
  if (headers === null) return;

  if (!headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const bodyTextarea = document.getElementById("body");
  const bodyText = bodyTextarea.value;

  const requestToSend = { method, url, isExecution: true, headers };
  const methodsWithBody = ["POST", "PUT", "PATCH"];
  if (methodsWithBody.includes(method) && bodyText.trim() !== "") {
    try {
      requestToSend.body = JSON.parse(bodyText);
    } catch {
      alert("Ошибка в JSON-теле");
      return;
    }
  }

  const response = await fetch("/proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestToSend),
  });

  const result = await response.json();
  renderResponse(result);
}

document.getElementById("runBtn").addEventListener("click", runRequest);
document.getElementById("saveBtn").addEventListener("click", saveRequest);
form.addEventListener("reset", () => {
  bodyBlock.style.display = "none";
  document.getElementById("body").value = "";
  document.getElementById("headerRows").innerHTML = "";
  document.getElementById("responseBox").style.display = "none";
});

loadSavedRequests();
