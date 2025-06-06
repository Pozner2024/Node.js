import { fetchWithSession, clearSessionId } from "./session.js";

export async function login(email, password) {
  try {
    const response = await fetchWithSession("/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error("Login failed");
    }

    return await response.json();
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
}

export async function logout() {
  try {
    await fetchWithSession("/logout", {
      method: "POST",
    });
    clearSessionId();
  } catch (error) {
    console.error("Logout error:", error);
    throw error;
  }
}

export async function checkAuth() {
  try {
    const response = await fetchWithSession("/whoami");
    if (!response.ok) {
      throw new Error("Not authenticated");
    }
    return await response.json();
  } catch (error) {
    console.error("Auth check error:", error);
    throw error;
  }
}
