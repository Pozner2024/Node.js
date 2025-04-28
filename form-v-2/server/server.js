const express = require("express");
const path = require("path");

const webserver = express();
const PORT = 3010;

webserver.use(express.static(path.join(__dirname)));
webserver.use(express.urlencoded({ extended: true }));

let lastErrors = null;
let lastValues = null;

const formTemplate = `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Форма</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
<div class="form-container">
  <h1>Заполните, пожалуйста, форму</h1>
  <form method="POST" action="/form">
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
  </div>
</body>
</html>
`;

const successTemplate = `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Успех!</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body class="success-page">
  <div class="success-container">
    <h1> Успешно!</h1>
    <p><strong>$[surname]</strong>, форма была успешно отправлена.</p>

    <form action="/form">
      <input type="submit" value="Заполнить снова">
    </form>
  </div>
</body>
</html>
`;

webserver.get("/form", (req, res) => {
  const formHTML = formTemplate
    .replace("$[surname]", `value="${lastValues?.surname || ""}"`)
    .replace("$[SURNAMEERR]", lastErrors?.SURNAMEERR || "")
    .replace("$[name]", `value="${lastValues?.name || ""}"`)
    .replace("$[NAMEERR]", lastErrors?.NAMEERR || "")
    .replace("$[age]", `value="${lastValues?.age || ""}"`)
    .replace("$[AGEERR]", lastErrors?.AGEERR || "")
    .replace("$[mail]", `value="${lastValues?.mail || ""}"`)
    .replace("$[MAILERR]", lastErrors?.MAILERR || "");

  lastErrors = null;
  lastValues = null;

  res.send(formHTML);
});

webserver.post("/form", (req, res) => {
  const { surname, name, age, mail } = req.body;

  const namePattern = /^[А-Яа-яЁё\- ]+$/;
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const errors = {};

  if (!surname || surname.length < 3 || !namePattern.test(surname)) {
    errors.SURNAMEERR = "Фамилия некорректна (от 3 букв, кириллица)";
  }

  if (!name || name.length < 3 || !namePattern.test(name)) {
    errors.NAMEERR = "Имя некорректно (от 3 букв, кириллица)";
  }

  if (!age || isNaN(age) || age < 10 || age > 100) {
    errors.AGEERR = "Возраст должен быть от 10 до 100";
  }

  if (!mail || !emailPattern.test(mail)) {
    errors.MAILERR = "Введите корректный email";
  }

  if (Object.keys(errors).length > 0) {
    const formHTML = formTemplate
      .replace("$[surname]", `value="${surname || ""}"`)
      .replace("$[SURNAMEERR]", errors.SURNAMEERR || "")
      .replace("$[name]", `value="${name || ""}"`)
      .replace("$[NAMEERR]", errors.NAMEERR || "")
      .replace("$[age]", `value="${age || ""}"`)
      .replace("$[AGEERR]", errors.AGEERR || "")
      .replace("$[mail]", `value="${mail || ""}"`)
      .replace("$[MAILERR]", errors.MAILERR || "");

    return res.send(formHTML);
  }

  // Если ошибок нет, редирект
  res.redirect(`/success?surname=${encodeURIComponent(surname)}`);
});

webserver.get("/success", (req, res) => {
  const surname = req.query.surname || "Пользователь";
  const successHTML = successTemplate.replace("$[surname]", surname);
  res.send(successHTML);
});

webserver.listen(PORT, () => {
  console.log(`Сервер запущен: http://localhost:${PORT}/form`);
});
