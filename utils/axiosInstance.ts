import axios from "axios";

const axiosInstance = axios.create({
  baseURL: "http://localhost:3002/api/v1",
  headers: { "Content-Type": "application/json" },
  timeout: 30000, // Increased to 30 seconds
});

axiosInstance.interceptors.request.use((config) => {
  // Check if JWT exists in localStorage
  if (typeof localStorage !== "undefined") {
    const token = localStorage.getItem("jwt_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.info("[SAMADHAAN] Using stored JWT token");
    }
  }
  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    
    if (status === 401 || status === 403) {
      console.warn(
        "[SAMADHAAN] Auth error:",
        status,
        "- Endpoint:",
        error.config?.url
      );
    } else if (status === 500) {
      console.error(
        "[SAMADHAAN] Backend error (500) - Endpoint:",
        error.config?.url
      );
    } else if (error.code === "ECONNABORTED") {
      console.warn("[SAMADHAAN] Request timeout - Consider increasing timeout or checking backend performance");
    } else if (error.code === "ERR_NETWORK") {
      console.warn("[SAMADHAAN] Network error (CORS or backend offline)");
    }
    
    return Promise.reject(error);
  }
);

export default axiosInstance;
