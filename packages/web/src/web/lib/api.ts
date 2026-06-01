import { hc } from "hono/client";
import type { AppType } from "../../api";
import { getToken } from "./auth";

// Create a client that injects the auth token on every request
const client = hc<AppType>("/", {
  headers: () => {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
});

export const api = client.api;
