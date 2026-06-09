import axios from "axios";

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

export const LOGO_URL = "https://customer-assets.emergentagent.com/job_wave-coach-3/artifacts/pde885i4_ChatGPT%20Image%2023%20mai%202026%20a%CC%80%2014_58_13.png";
