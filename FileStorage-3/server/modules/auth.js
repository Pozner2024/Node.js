import bcrypt from "bcrypt";
import crypto from "crypto";
import path from "path";
import nodemailer from "nodemailer";
import {
  findUserByEmail,
  createUser,
  activateUser,
  findActiveUserByEmail,
} from "./db.js";
import { CLIENT_DIR, emailConfig } from "./config.js";

const transporter = nodemailer.createTransport(emailConfig);

// Функция для отправки письма активации
async function sendActivationEmail(email, activationLink) {
  try {
    await transporter.sendMail({
      from: emailConfig.auth.user,
      to: email,
      subject: "Активация аккаунта FileStorage",
      html: `
        <h1>Добро пожаловать в FileStorage!</h1>
        <p>Для активации вашего аккаунта, пожалуйста, перейдите по следующей ссылке:</p>
        <p><a href="${activationLink}">${activationLink}</a></p>
        <p>Если вы не регистрировались на нашем сайте, просто проигнорируйте это письмо.</p>
      `,
    });
    console.log(`✓ Письмо успешно отправлено на ${email}`);
  } catch (error) {
    console.error("Ошибка при отправке письма:", error);
    throw error;
  }
}

// Middleware для проверки авторизации
export async function requireAuth(req, res, next) {
  if (req.session && req.session.user_email) {
    try {
      const user = await findActiveUserByEmail(req.session.user_email);
      if (user) {
        req.user = user;
        return next();
      }
    } catch (e) {
      console.error("Ошибка при проверке сессии в БД:", e);
    }
  }

  // Для AJAX/fetch (Accept: application/json) вернём JSON 401
  if (req.xhr || req.headers.accept?.includes("application/json")) {
    return res.status(401).json({ error: "Неавторизован" });
  }
  // Иначе редиректим на login
  res.redirect("/");
}

// Маршруты аутентификации
export function setupAuthRoutes(app) {
  // GET /register → register.html
  app.get("/register", (req, res) => {
    res.sendFile(path.join(CLIENT_DIR, "register.html"));
  });

  // POST /register → создаём нового пользователя (неактивного)
  app.post("/register", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).send("Нужно указать все поля.");
      }

      const existingUser = await findUserByEmail(email);
      if (existingUser) {
        return res.status(400).send("E-mail уже зарегистрирован.");
      }

      // Хешируем пароль
      const hash = await bcrypt.hash(password, 10);
      // Генерируем токен активации
      const activationToken = crypto.randomBytes(20).toString("hex");

      // Создаем пользователя
      await createUser(email, hash, activationToken);

      // Формируем ссылку активации
      const activationLink = `http://${req.headers.host}/activate?token=${activationToken}`;

      // Отправляем письмо с ссылкой активации
      await sendActivationEmail(email, activationLink);

      return res
        .status(200)
        .send(
          "Регистрация прошла успешно. Проверьте вашу почту и перейдите по ссылке для активации аккаунта."
        );
    } catch (err) {
      console.error("Ошибка при регистрации:", err);
      res.status(500).send("Ошибка на сервере во время регистрации.");
    }
  });

  // активация аккаунта
  app.get("/activate", async (req, res) => {
    const { token } = req.query;
    if (!token) {
      return res.status(400).send("Токен активации не указан.");
    }
    try {
      const email = await activateUser(token);
      if (!email) {
        return res.status(400).send("Неверный или устаревший токен активации.");
      }

      // После активации редиректим на страницу входа
      return res.redirect("/");
    } catch (err) {
      console.error("Ошибка при активации:", err);
      res.status(500).send("Ошибка на сервере при активации аккаунта.");
    }
  });

  // POST /login → проверяем email, пароль и is_active
  app.post("/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).send("Нужно указать email и пароль.");
      }

      // Ищем пользователя по email
      const user = await findUserByEmail(email);
      if (!user) {
        return res.status(400).send("Неверный email или пароль.");
      }

      // Проверяем пароль
      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) {
        return res.status(400).send("Неверный email или пароль.");
      }

      // Проверяем активацию
      if (!user.is_active) {
        return res.status(400).send("Аккаунт не активирован. Проверьте почту.");
      }

      // Сохраняем email в сессии
      req.session.user_email = email;
      res.status(200).send("OK");
    } catch (err) {
      console.error("Ошибка при входе:", err);
      res.status(500).send("Ошибка на сервере при попытке входа.");
    }
  });

  // GET /logout → выход (уничтожаем сессию)
  app.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/");
  });
}
