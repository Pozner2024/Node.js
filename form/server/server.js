const express = require("express");
const path = require("path");

const webserver = express();
const PORT = 3000;

// Подключение статики (стили)
webserver.use(express.static(path.join(__dirname)));

const formTemplate = `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Форма</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <form action="/form">
    <label>
      Фамилия:
      <input type="text" name="surname" $[surname]>
      <span class="error">$[SURNAMEERR]</span>
    </label><br><br>

    <label>
      Имя:
      <input type="text" name="name" $[name]>
      <span class="error">$[NAMEERR]</span>
    </label><br><br>

    <label>
      Возраст:
      <input type="number" name="age" $[age]>
      <span class="error">$[AGEERR]</span>
    </label><br><br>

    <label>
      E-mail:
      <input type="email" name="mail" $[mail]>
      <span class="error">$[MAILERR]</span>
    </label><br><br>

    <input type="submit" value="Отправить">
  </form>
</body>
</html>
`;

const successTemplate = `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Успех</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <h1>Отлично!</h1>
  <p>$[surname], форма заполнена верно!</p>

  <form action="/form">
    <input type="submit" value="Заполнить снова">
  </form>
</body>
</html>
`;

webserver.get("/form", (req, res) => {
  const { surname, name, age, mail } = req.query;

  const isFirstVisit = Object.keys(req.query).length === 0;

  // Ошибки только если это не первый заход
  let SURNAMEERR = "";
  let NAMEERR = "";
  let AGEERR = "";
  let MAILERR = "";

  if (!isFirstVisit) {
    const namePattern = /^[А-Яа-яЁё\- ]+$/;

    if (!surname) {
      SURNAMEERR = "Пожалуйста, введите фамилию";
    } else if (surname.length < 3) {
      SURNAMEERR = "Фамилия слишком короткая!";
    } else if (!namePattern.test(surname)) {
      SURNAMEERR = "Фамилия должна содержать только буквы";
    }

    if (!name) {
      NAMEERR = "Введите имя!";
    } else if (name.length < 3) {
      NAMEERR = "Имя слишком короткое!";
    } else if (!namePattern.test(name)) {
      NAMEERR = "Имя должно содержать только буквы";
    }

    if (!age) {
      AGEERR = "Возраст обязателен";
    } else if (isNaN(age)) {
      AGEERR = "Возраст должен быть числом";
    } else if (age < 10 || age > 100) {
      AGEERR = "Возраст должен быть от 10 до 100";
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!mail) {
      MAILERR = "E-mail обязателен";
    } else if (!emailPattern.test(mail)) {
      MAILERR = "Введите корректный e-mail";
    }
  }

  if (!SURNAMEERR && !NAMEERR && !AGEERR && !MAILERR && !isFirstVisit) {
    const successHTML = successTemplate.replace("$[surname]", surname);
    res.send(successHTML);
  } else {
    const errorFormHTML = formTemplate
      .replace("$[surname]", `value="${surname || ""}"`)
      .replace("$[SURNAMEERR]", SURNAMEERR)
      .replace("$[name]", `value="${name || ""}"`)
      .replace("$[NAMEERR]", NAMEERR)
      .replace("$[age]", `value="${age || ""}"`)
      .replace("$[AGEERR]", AGEERR)
      .replace("$[mail]", `value="${mail || ""}"`)
      .replace("$[MAILERR]", MAILERR);

    res.send(errorFormHTML);
  }
});

webserver.listen(PORT, () => {
  console.log(`Сервер запущен: http://localhost:${PORT}/form`);
});
