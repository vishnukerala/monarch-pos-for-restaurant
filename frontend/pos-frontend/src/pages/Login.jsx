import { useEffect, useState } from "react";
import axios from "axios";
import {
  ROLE_WAITER,
  normalizeRole,
  writeRolePermissionOverrides,
} from "../lib/accessControl";
import { apiUrl } from "../lib/api";
import {
  normalizeLoginBranding,
  readStoredLoginBranding,
  writeStoredLoginBranding,
} from "../lib/loginBranding";

const SAVED_LOGIN_KEY = "saved_login_credentials";
const LOGIN_REQUEST_TIMEOUT_MS = 8000;

function getLoginApiCandidates(path) {
  const primaryUrl = apiUrl(path);

  if (typeof window === "undefined") {
    return [primaryUrl];
  }

  const { protocol, hostname } = window.location;
  const normalizedHostname = String(hostname || "").trim().toLowerCase();
  const isLocalHost =
    normalizedHostname === "localhost" ||
    normalizedHostname === "127.0.0.1" ||
    normalizedHostname === "::1";

  if (isLocalHost) {
    return [primaryUrl];
  }

  const localhostUrl = `${protocol}//localhost:8000${
    String(path || "").startsWith("/") ? path : `/${path}`
  }`;

  return Array.from(new Set([primaryUrl, localhostUrl]));
}

async function requestLoginApi(method, path, data) {
  const candidates = getLoginApiCandidates(path);
  const requests = candidates.map((requestUrl) =>
    axios({
      method,
      url: requestUrl,
      data,
      timeout: LOGIN_REQUEST_TIMEOUT_MS,
    }),
  );

  try {
    return await Promise.any(requests);
  } catch (error) {
    const aggregatedErrors = Array.isArray(error?.errors) ? error.errors : [];
    const firstResponseError = aggregatedErrors.find(
      (requestError) => requestError?.response,
    );

    if (firstResponseError) {
      throw firstResponseError;
    }

    if (aggregatedErrors.length > 0) {
      throw aggregatedErrors[0];
    }

    throw error;
  }
}

function getErrorMessage(error) {
  const responseError = error?.response?.data?.error;

  if (typeof responseError === "string" && responseError.trim()) {
    return responseError;
  }

  if (typeof error?.response?.data === "string" && error.response.data.trim()) {
    return error.response.data;
  }

  if (error?.code === "ECONNABORTED") {
    return "Login request timed out. Check whether the backend is running on port 8000.";
  }

  if (error?.message === "Network Error") {
    return "Backend not connected. Please start the server and try again.";
  }

  if (typeof error?.message === "string" && error.message.trim()) {
    return error.message;
  }

  return "Login failed";
}

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [savePassword, setSavePassword] = useState(false);
  const [loginBranding, setLoginBranding] = useState(() =>
    readStoredLoginBranding(),
  );

  useEffect(() => {
    try {
      const rawValue = localStorage.getItem(SAVED_LOGIN_KEY);

      if (!rawValue) {
        return;
      }

      const savedCredentials = JSON.parse(rawValue);
      setUsername(String(savedCredentials.username || ""));
      setPassword(String(savedCredentials.password || ""));
      setSavePassword(
        Boolean(savedCredentials.username) || Boolean(savedCredentials.password),
      );
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    const loadLoginBranding = async () => {
      try {
        const response = await requestLoginApi("get", "/stock/login-branding");
        const normalizedBranding = normalizeLoginBranding(response.data);
        setLoginBranding(normalizedBranding);
        writeStoredLoginBranding(normalizedBranding);
      } catch (error) {
        console.error(error);
        setLoginBranding(readStoredLoginBranding());
      }
    };

    loadLoginBranding();
  }, []);

  const login = async () => {
    try {
      setLoading(true);

      const res = await requestLoginApi("post", "/login", {
        username: username.trim(),
        password: password.trim(),
      });

      if (res.data.error) {
        alert("Invalid login");
        return;
      }

      const normalizedRole = normalizeRole(res.data.role);

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("role", normalizedRole);
      localStorage.setItem("userId", String(res.data.id ?? ""));
      localStorage.setItem("username", res.data.username ?? username.trim());
      writeRolePermissionOverrides(res.data.permission_overrides);

      if (savePassword) {
        localStorage.setItem(
          SAVED_LOGIN_KEY,
          JSON.stringify({
            username: username.trim(),
            password: password.trim(),
          }),
        );
      } else {
        localStorage.removeItem(SAVED_LOGIN_KEY);
      }

      window.location.replace(
        normalizedRole === ROLE_WAITER ? "/waiter" : "/billing",
      );

    } catch (err) {
      console.error(err);
      alert(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">

      <div className="w-full max-w-md p-8 bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20">
        {loginBranding.logo_enabled && loginBranding.logo_image && (
          <img
            src={loginBranding.logo_image}
            alt="Login logo"
            className="mx-auto mb-5 max-h-24 max-w-[240px] object-contain"
          />
        )}

        <h1 className="text-3xl font-bold text-center text-white mb-2">
          Sign In
        </h1>

        <p className="text-center text-gray-300 mb-6">
          Sign in to continue
        </p>

        <input
          type="text"
          placeholder="Username"
          value={username}
          className="w-full p-3 mb-4 rounded-lg bg-white/20 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
          onChange={(e) => setUsername(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          className="w-full p-3 mb-6 rounded-lg bg-white/20 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
          onChange={(e) => setPassword(e.target.value)}
        />

        <label className="mb-6 flex items-center gap-3 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={savePassword}
            onChange={(e) => setSavePassword(e.target.checked)}
            className="h-4 w-4 rounded border-white/30 bg-white/10 text-blue-500 focus:ring-blue-400"
          />
          <span>Save Password</span>
        </label>

        <button
          onClick={login}
          disabled={loading}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-lg font-semibold transition"
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        <div className="mt-6 text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
          Copyright CAFEMONARCH
        </div>

      </div>

    </div>
  );
}
