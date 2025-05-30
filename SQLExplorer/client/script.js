document.getElementById("run").onclick = async () => {
  const sql = document.getElementById("sql").value.trim();
  const out = document.getElementById("output");
  out.innerHTML = "";

  if (!sql) {
    out.textContent = "Пожалуйста, введите SQL-запрос.";
    return;
  }

  const loading = document.createElement("div");
  loading.textContent = "Выполняется запрос…";
  out.appendChild(loading);

  try {
    const resp = await fetch("/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sql }),
    });
    const data = await resp.json();
    out.innerHTML = "";

    const title = document.createElement("h2");
    if (data.type === "select") {
      title.textContent = "Результат запроса:";
      out.appendChild(title);

      // строим таблицу
      let html =
        "<table><tr>" +
        data.columns.map((c) => `<th>${c}</th>`).join("") +
        "</tr>";
      for (let row of data.rows) {
        html +=
          "<tr>" +
          data.columns.map((c) => `<td>${row[c]}</td>`).join("") +
          "</tr>";
      }
      html += "</table>";
      out.insertAdjacentHTML("beforeend", html);
    } else if (data.type === "modify") {
      title.textContent = "Модификация данных:";
      out.appendChild(title);

      const msg = document.createElement("div");
      msg.textContent = `Изменено строк: ${data.rowCount}`;
      out.appendChild(msg);
    } else {
      title.textContent = "Ошибка выполнения:";
      out.appendChild(title);

      const err = document.createElement("div");
      err.textContent = data.message;
      err.style.color = "red";
      out.appendChild(err);
    }
  } catch (e) {
    out.innerHTML = `<div style="color:red">Сетевая ошибка: ${e.message}</div>`;
  }
};

document.querySelectorAll(".preset").forEach((btn) => {
  btn.addEventListener("click", () => {
    const textarea = document.getElementById("sql");
    textarea.value = btn.textContent;
    textarea.focus();
  });
});
