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

function resolveDirectApiUrl() {
  const configured = (process.env.REACT_APP_DIRECT_API_URL || "").replace(/\/$/, "");
  if (configured) return configured;
  if (typeof window !== "undefined") {
    const { hostname } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return (process.env.REACT_APP_BACKEND_URL || "http://localhost:8000").replace(/\/$/, "");
    }
  }
  return "https://rideup5-production.up.railway.app";
}

export const BACKEND_URL = resolveBackendUrl();
export const DIRECT_API_URL = resolveDirectApiUrl();

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

/** Session + direct Railway URL for large video uploads (bypasses Vercel proxy). */
export async function fetchUploadConfig() {
  const r = await api.get("/auth/upload-config");
  return r.data;
}

export function createDirectApiClient(sessionToken) {
  const base = (sessionToken?.direct_api_url || DIRECT_API_URL).replace(/\/$/, "");
  return axios.create({
    baseURL: `${base}/api`,
    headers: { Authorization: `Bearer ${sessionToken?.session_token || sessionToken}` },
    withCredentials: false,
  });
}

export function formatApiError(err) {
  const detail = err.response?.data?.detail;
  if (detail) {
    return typeof detail === "string" ? detail : JSON.stringify(detail);
  }
  if (err.code === "ECONNABORTED") {
    return "L'analyse a pris trop de temps. Réessaie avec un clip plus court (max 20 s).";
  }
  if (err.message === "Network Error") {
    return "Connexion interrompue pendant l'envoi. Réessaie — si le problème persiste, utilise un clip plus léger.";
  }
  return err.message || "Erreur lors de l'analyse";
}

export const LOGO_URL = "/logo.png";
