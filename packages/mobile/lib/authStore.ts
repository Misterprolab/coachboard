/**
 * Auth store — JWT token management for web platform.
 * Uses localStorage on web, no-op on native (native uses local SQLite, no auth needed).
 */
import { Platform } from "react-native";

const TOKEN_KEY = "cb_auth_token";
const ROLE_KEY = "cb_auth_role";
const EMAIL_KEY = "cb_auth_email";

export function getToken(): string | null {
  if (Platform.OS !== "web") return null;
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function getRole(): string | null {
  if (Platform.OS !== "web") return null;
  try { return localStorage.getItem(ROLE_KEY); } catch { return null; }
}

export function getEmail(): string | null {
  if (Platform.OS !== "web") return null;
  try { return localStorage.getItem(EMAIL_KEY); } catch { return null; }
}

export function setAuth(token: string, role: string, email: string) {
  if (Platform.OS !== "web") return;
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(ROLE_KEY, role);
    localStorage.setItem(EMAIL_KEY, email);
  } catch {}
}

export function clearAuth() {
  if (Platform.OS !== "web") return;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(EMAIL_KEY);
  } catch {}
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

// Base URL for API calls — on web, use relative path
export const API_BASE = "";

export async function apiGet(path: string) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`API error ${res.status} on GET ${path}`);
  return res.json();
}

export async function apiPost(path: string, body: any) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error ?? `API error ${res.status} on POST ${path}`);
  }
  return res.json();
}

export async function apiPut(path: string, body: any) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error ${res.status} on PUT ${path}`);
  return res.json();
}

export async function apiDelete(path: string) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`API error ${res.status} on DELETE ${path}`);
  return res.json();
}
