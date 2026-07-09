import axios from "axios";

function resolveBackendUrl() {
  const configured = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/$/, "");

  if (typeof window === "undefined") {
    return configured;
  }

  const { origin, hostname } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return configured || "http://localhost:8000";
  }

  // Production: same-origin /api via Vercel rewrite (cookies + auth).
  return origin;
}

export const BACKEND_URL = resolveBackendUrl();

if (!BACKEND_URL && process.env.NODE_ENV !== "production") {
  console.error(
    "[RIDE'UP] REACT_APP_BACKEND_URL manquant. Crée frontend/.env avec REACT_APP_BACKEND_URL=http://localhost:8000"
  );
}

export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

export const LOGO_URL = "/logo.png";
