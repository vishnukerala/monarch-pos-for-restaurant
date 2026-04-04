function getDefaultApiBase() {
  if (typeof window === "undefined") {
    return "http://localhost:8000";
  }

  const { protocol, hostname } = window.location;
  const resolvedHost =
    hostname && hostname !== "0.0.0.0" ? hostname : "localhost";

  return `${protocol}//${resolvedHost}:8000`;
}

export const API = (
  import.meta.env.VITE_API_URL || getDefaultApiBase()
).replace(/\/+$/, "");

export function apiUrl(path) {
  const normalizedPath = String(path || "");
  return `${API}${normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`}`;
}
