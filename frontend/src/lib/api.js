import axios from "axios";

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

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
