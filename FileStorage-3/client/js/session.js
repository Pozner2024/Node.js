// Функции для работы с сессией на клиенте
export function getSessionId() {
  return localStorage.getItem("sessionId");
}

export function setSessionId(sessionId) {
  localStorage.setItem("sessionId", sessionId);
}

export function clearSessionId() {
  localStorage.removeItem("sessionId");
}

// Функция для добавления sessionId к запросам
export function addSessionHeader(headers = {}) {
  const sessionId = getSessionId();
  if (sessionId) {
    headers["X-Session-ID"] = sessionId;
  }
  return headers;
}

// Пример использования при fetch запросах
export async function fetchWithSession(url, options = {}) {
  const headers = addSessionHeader(options.headers || {});
  const response = await fetch(url, { ...options, headers });

  // Если в ответе есть новый sessionId, сохраняем его
  const newSessionId = response.headers.get("X-Session-ID");
  if (newSessionId) {
    setSessionId(newSessionId);
  }

  return response;
}
