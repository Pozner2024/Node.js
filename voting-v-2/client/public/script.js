function isValidId(id) {
  return [1, 2, 3].includes(id);
}
//запрашиваем данные вопроса и ответов с сервера, показываем их на странице
async function loadVotingData() {
  try {
    const response = await fetch("/variants");
    const data = await response.json();

    document.getElementById("question").innerHTML = `<h1>${data.question}</h1>`;

    if (data.answers && data.answers.length >= 3) {
      document.getElementById("btn1").textContent = data.answers[0].text;
      document.getElementById("btn2").textContent = data.answers[1].text;
      document.getElementById("btn3").textContent = data.answers[2].text;
    }
  } catch (error) {
    console.error("Ошибка при загрузке данных голосования:", error);
  }
}

// Отправляем POST-запрос на сервер, получаем ответ, обновляем счётчики
async function vote(answerId) {
  if (!isValidId(answerId)) {
    alert("Недопустимый вариант ответа.");
    return;
  }

  try {
    const response = await fetch("/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voteId: answerId }),
    });
    const result = await response.json();

    document.getElementById("brave-men-count").textContent = result.votes["1"];
    document.getElementById("cowards-count").textContent = result.votes["2"];
    document.getElementById("introverts-count").textContent = result.votes["3"];
  } catch (error) {
    console.error("Ошибка при отправке голоса:", error);
  }
}

//функция для загрузки текущих результатов
async function loadStats() {
  try {
    const response = await fetch("/stat", {
      method: "POST",
    });

    const result = await response.json();

    document.getElementById("brave-men-count").textContent = result[1];
    document.getElementById("cowards-count").textContent = result[2];
    document.getElementById("introverts-count").textContent = result[3];
  } catch (error) {
    console.error("Ошибка при получении статистики:", error);
  }
}
//загрузка данных
function downloadStats(type) {
  fetch("/download", {
    headers: {
      Accept: type,
    },
  })
    .then((res) => res.blob())
    .then((blob) => {
      let ext = {
        "application/json": "json",
        "application/xml": "xml",
        "text/html": "html",
      }[type];

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `stats.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    })
    .catch((err) => console.error("Ошибка скачивания:", err));
}

document.getElementById("btn1").addEventListener("click", () => vote(1));
document.getElementById("btn2").addEventListener("click", () => vote(2));
document.getElementById("btn3").addEventListener("click", () => vote(3));
document
  .getElementById("download-xml")
  .addEventListener("click", () => downloadStats("application/xml"));
document
  .getElementById("download-html")
  .addEventListener("click", () => downloadStats("text/html"));
document
  .getElementById("download-json")
  .addEventListener("click", () => downloadStats("application/json"));

loadVotingData();
loadStats();
