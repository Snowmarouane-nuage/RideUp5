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
    return (
      "La connexion a expiré pendant l'envoi. "
      + "Si l'upload était terminé, vérifie l'historique — l'analyse continue peut-être en arrière-plan."
    );
  }
  if (err.message === "Network Error" || err.code === "ERR_NETWORK") {
    return (
      "Connexion interrompue pendant l'envoi. Réessaie dans quelques secondes. "
      + "Ce n'est pas lié à la durée de ta vidéo."
    );
  }
  if (err.response?.status === 401) {
    return "Session expirée — reconnecte-toi puis réessaie l'analyse.";
  }
  if (err.response?.status === 402 || err.response?.status === 403) {
    return "Abonnement requis pour l'analyse vidéo. Vérifie ton plan ou ADMIN_EMAILS sur Railway.";
  }
  return err.message || "Erreur lors de l'analyse";
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        resolve(result.split(",")[1] || "");
      } else {
        reject(new Error("Lecture du fichier impossible"));
      }
    };
    reader.onerror = () => reject(reader.error || new Error("Lecture du fichier impossible"));
    reader.readAsDataURL(blob);
  });
}

/** Upload video in small same-origin chunks (reliable through Vercel proxy). */
export async function uploadVideoChunked(file, fields, { onProgress } = {}) {
  const CHUNK_BYTES = 750_000;
  const uploadId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, "")
      : `up${Date.now()}${Math.random().toString(16).slice(2)}`;

  const total = Math.max(1, Math.ceil(file.size / CHUNK_BYTES));
  for (let i = 0; i < total; i++) {
    const start = i * CHUNK_BYTES;
    const slice = file.slice(start, Math.min(start + CHUNK_BYTES, file.size));
    const data = await blobToBase64(slice);
    await api.post(
      "/video-analysis/chunk",
      {
        upload_id: uploadId,
        chunk_index: i,
        chunk_total: total,
        data,
      },
      { timeout: 120000 },
    );
    if (onProgress) onProgress(Math.round(((i + 1) / total) * 100));
  }

  const complete = await api.post(
    "/video-analysis/complete",
    {
      upload_id: uploadId,
      filename: file.name || "video.mp4",
      sport: fields.sport,
      level: fields.level,
      trick: fields.trick || "",
      problem: fields.problem || "",
      conditions: fields.conditions || "",
    },
    { timeout: 120000 },
  );
  return complete.data;
}

const JOB_PROGRESS_LABELS = {
  uploaded: "Vidéo reçue — préparation de l'analyse…",
  extracting_frames: "Extraction des 96 images de ton clip…",
  analyzing: "Analyse IA en cours (1 à 3 minutes) — ne ferme pas la page",
  saving: "Finalisation du rapport…",
  done: "Terminé",
};

export function jobProgressLabel(progress) {
  return JOB_PROGRESS_LABELS[progress] || "Analyse en cours…";
}

/** Poll a background analysis job until completed or failed. */
export async function pollAnalysisJob(directClient, jobId, { onProgress, intervalMs = 3000, maxAttempts = 200 } = {}) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const r = await directClient.get(`/video-analysis/jobs/${jobId}`, { timeout: 45000 });
    const { status, progress, error, result } = r.data;
    if (progress && onProgress) onProgress(progress);
    if (status === "completed" && result) return result;
    if (status === "failed") {
      throw Object.assign(new Error(error || "Analyse échouée"), { response: { data: { detail: error } } });
    }
    await new Promise((res) => setTimeout(res, intervalMs));
  }
  throw new Error(
    "L'analyse prend plus de temps que prévu. Recharge la page et consulte l'historique dans quelques minutes.",
  );
}

export const LOGO_URL = "/logo.png";
