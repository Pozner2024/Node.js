import bcrypt from "bcrypt";
import crypto from "crypto";
import path from "path";
import nodemailer from "nodemailer";
import Handlebars from "handlebars";
import fs from "fs/promises";

import { findUserByEmail, createUser, findActiveUserByEmail } from "./db.js";
import { CLIENT_DIR, emailConfig } from "./config.js";
import {
  storePendingUser,
  getPendingUser,
  removePendingUser,
  isPendingEmail,
} from "./tempStorage.js";

const transporter = nodemailer.createTransport(emailConfig);

async function sendActivationEmail(email, activationLink) {
  try {
    await transporter.verify();

    // Читаем шаблон
    const templatePath = path.join(
      path.dirname(new URL(import.meta.url).pathname),
      "..",
      "templates",
      "activation-email.hbs"
    );

    const template = await fs.readFile(templatePath, "utf8");

    // Компилируем шаблон
    const compiledTemplate = Handlebars.compile(template);

    // Рендерим HTML с данными
    const html = compiledTemplate({ activationLink });

    await transporter.sendMail({
      from: emailConfig.auth.user,
      to: email,
      subject: "Активация аккаунта FileStorage",
      html: html,
    });

    console.log(`✓ Письмо успешно отправлено на ${email}`);
  } catch (error) {
    console.error("Ошибка при отправке активационного письма:", error);
    throw error;
  }
}

export async function requireAuth(req, res, next) {
  if (req.session?.user_email) {
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

  if (req.xhr || req.headers.accept?.includes("application/json")) {
    return res.status(401).json({ error: "Неавторизован" });
  }

  res.redirect("/");
}

export function setupAuthRoutes(app) {
  app.get("/register", (req, res) => {
    res.sendFile(path.join(CLIENT_DIR, "register.html"));
  });

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

      const hash = await bcrypt.hash(password, 10);
      const activationToken = crypto.randomBytes(20).toString("hex");

      storePendingUser(activationToken, {
        email,
        password_hash: hash,
      });

      const activationLink = `http://${req.headers.host}/activate?token=${activationToken}`;

      await sendActivationEmail(email, activationLink);

      return res
        .status(200)
        .send("Регистрация прошла успешно. Проверьте почту для активации.");
    } catch (err) {
      console.error("Ошибка при регистрации:", err);
      res.status(500).send("Ошибка на сервере во время регистрации.");
    }
  });

  app.get("/activate", (req, res) => {
    const { token } = req.query;
    if (!token) {
      return res.status(400).send("Токен активации не указан.");
    }

    const pending = getPendingUser(token);
    if (!pending) {
      return res.status(400).send("Неверный или устаревший токен активации.");
    }

    createUser(pending.email, pending.password_hash)
      .then(() => {
        removePendingUser(token);
        res.redirect("/");
      })
      .catch((err) => {
        console.error("Ошибка при активации:", err);
        res.status(500).send("Ошибка на сервере при активации аккаунта.");
      });
  });

  app.get("/whoami", requireAuth, (req, res) => {
    res.json({ username: req.user.user_email });
  });

  app.post("/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).send("Нужно указать email и пароль.");
      }

      // Если регистрация не подтверждена
      if (isPendingEmail(email)) {
        return res
          .status(400)
          .send(
            "Подтвердите регистрацию! Проверьте Ваш емейл и перейдите по ссылке."
          );
      }

      const user = await findUserByEmail(email);
      if (!user) {
        return res.status(400).send("Неверный email или пароль.");
      }

      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) {
        return res.status(400).send("Неверный email или пароль.");
      }

      if (!user.is_active) {
        return res.status(400).send("Аккаунт не активирован. Проверьте почту.");
      }

      req.session.user_email = email;
      res.status(200).send("OK");
    } catch (err) {
      console.error("Ошибка при входе:", err);
      res.status(500).send("Ошибка на сервере при попытке входа.");
    }
  });

  app.get("/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) console.error("Ошибка при уничтожении сессии:", err);
      res.redirect("/");
    });
  });
}
