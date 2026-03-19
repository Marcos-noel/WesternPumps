import axios from "axios";

// In production, prefer same-origin API calls and rely on platform rewrites (e.g. Vercel) to reach the backend.
// This avoids mixed-content + CORS issues on mobile and makes deployments resilient when env vars are missing.
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").trim();
const disableAuth = import.meta.env.VITE_DISABLE_AUTH === "true";

export const api = axios.create({
  baseURL: apiBaseUrl || ""
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  const activeTenantId = localStorage.getItem("active_tenant_id");
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (activeTenantId && activeTenantId.trim() !== "") {
    config.headers = config.headers ?? {};
    config.headers["X-Tenant-ID"] = activeTenantId.trim();
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!disableAuth && axios.isAxiosError(error) && error.response?.status === 401) {
      localStorage.removeItem("access_token");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);
