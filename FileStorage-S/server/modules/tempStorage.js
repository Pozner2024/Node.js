// Временное хранилище для неподтвержденных пользователей
const pendingUsers = new Map();

// Время жизни временных данных (24 часа)
const EXPIRY_TIME = 24 * 60 * 60 * 1000;

export function storePendingUser(activationToken, userData) {
  pendingUsers.set(activationToken, {
    ...userData,
    createdAt: Date.now(),
  });

  // Автоматическое удаление по истечении срока
  setTimeout(() => {
    pendingUsers.delete(activationToken);
  }, EXPIRY_TIME);
}

export function getPendingUser(activationToken) {
  const userData = pendingUsers.get(activationToken);
  if (!userData) return null;

  if (Date.now() - userData.createdAt > EXPIRY_TIME) {
    pendingUsers.delete(activationToken);
    return null;
  }

  return userData;
}

export function removePendingUser(activationToken) {
  pendingUsers.delete(activationToken);
}

// Проверка, есть ли неподтверждённый пользователь с данным email
export function isPendingEmail(email) {
  for (const [token, userData] of pendingUsers.entries()) {
    if (userData.email === email) {
      // проверим не истёк ли срок
      if (Date.now() - userData.createdAt <= EXPIRY_TIME) {
        return true;
      }
      pendingUsers.delete(token);
    }
  }
  return false;
}
