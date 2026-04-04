import { useEffect, useState } from "react";
import axios from "axios";
import AppSidebarLayout from "../components/AppSidebarLayout";
import { getStoredUser } from "../lib/accessControl";
import { API } from "../lib/api";
import {
  DEFAULT_LOGIN_BRANDING,
  normalizeLoginBranding,
  readStoredLoginBranding,
  writeStoredLoginBranding,
} from "../lib/loginBranding";

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
}

async function prepareLoginLogoImage(file, maxWidth = 320) {
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImageFromDataUrl(dataUrl);

  if (image.width <= maxWidth) {
    return dataUrl;
  }

  const scale = maxWidth / image.width;
  const canvas = document.createElement("canvas");
  canvas.width = maxWidth;
  canvas.height = Math.max(Math.round(image.height * scale), 1);
  const context = canvas.getContext("2d");

  if (!context) {
    return dataUrl;
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(file.type === "image/png" ? "image/png" : "image/jpeg");
}

function getErrorMessage(error, fallbackMessage) {
  const responseError = error?.response?.data?.error;

  if (typeof responseError === "string" && responseError.trim()) {
    return responseError;
  }

  if (typeof error?.response?.data === "string" && error.response.data.trim()) {
    return error.response.data;
  }

  if (typeof error?.message === "string" && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
}

function LoginCardPreview({ branding }) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        Login Preview
      </div>
      <div className="mt-4 rounded-[28px] bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 p-6 shadow-xl">
        <div className="rounded-2xl border border-white/20 bg-white/10 p-6 text-center backdrop-blur-xl">
          {branding.logo_enabled && branding.logo_image ? (
            <img
              src={branding.logo_image}
              alt="Login logo preview"
              className="mx-auto max-h-24 max-w-[240px] object-contain"
            />
          ) : (
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/10 text-4xl text-white">
              POS
            </div>
          )}

          <div className="mt-5 text-3xl font-bold text-white">
            Restaurant POS
          </div>
          <div className="mt-2 text-sm text-slate-300">Sign in to continue</div>

          <div className="mt-6 space-y-3">
            <div className="rounded-xl bg-white/20 px-4 py-3 text-left text-sm text-slate-300">
              Username
            </div>
            <div className="rounded-xl bg-white/20 px-4 py-3 text-left text-sm text-slate-300">
              Password
            </div>
            <div className="rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white">
              Login
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginBrandingPage() {
  const { role } = getStoredUser();
  const [branding, setBranding] = useState(() => readStoredLoginBranding());
  const [saveState, setSaveState] = useState("idle");

  useEffect(() => {
    const loadBranding = async () => {
      try {
        const response = await axios.get(`${API}/stock/login-branding`);
        const normalizedBranding = normalizeLoginBranding(response.data);
        setBranding(normalizedBranding);
        writeStoredLoginBranding(normalizedBranding);
      } catch (error) {
        console.error(error);
        setBranding(readStoredLoginBranding());
      }
    };

    loadBranding();
  }, []);

  useEffect(() => {
    if (saveState !== "saved") {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setSaveState("idle");
    }, 1600);

    return () => clearTimeout(timeoutId);
  }, [saveState]);

  const handleLogoChange = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!["image/png", "image/jpeg"].includes(file.type)) {
      alert("Login logo supports PNG or JPG only");
      event.target.value = "";
      return;
    }

    try {
      const logoImage = await prepareLoginLogoImage(file, 320);
      setBranding((currentValue) => ({
        ...currentValue,
        logo_enabled: true,
        logo_image: logoImage,
      }));
      setSaveState("idle");
    } catch (error) {
      console.error(error);
      alert("Failed to prepare login logo");
    } finally {
      event.target.value = "";
    }
  };

  const saveBranding = async () => {
    try {
      setSaveState("saving");
      const response = await axios.put(`${API}/stock/login-branding`, branding);

      if (response.data?.error) {
        setSaveState("idle");
        alert(response.data.error);
        return;
      }

      const normalizedBranding = normalizeLoginBranding(
        response.data?.settings || branding,
      );
      setBranding(normalizedBranding);
      writeStoredLoginBranding(normalizedBranding);
      setSaveState("saved");
    } catch (error) {
      console.error(error);
      setSaveState("idle");
      alert(getErrorMessage(error, "Failed to save login branding"));
    }
  };

  return (
    <AppSidebarLayout role={role} currentPage="login-branding">
      <div className="space-y-4">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">
                Administration
              </div>
              <h1 className="mt-2 text-2xl font-bold text-slate-900">
                Login Branding
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                Upload a logo for the login screen so admins can update branding
                without code changes.
              </p>
            </div>

            <div
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${
                saveState === "saved"
                  ? "bg-emerald-100 text-emerald-700"
                  : saveState === "saving"
                    ? "bg-sky-100 text-sky-700"
                    : "bg-slate-100 text-slate-600"
              }`}
            >
              {saveState === "saved"
                ? "Saved"
                : saveState === "saving"
                  ? "Saving"
                  : "Draft"}
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      Login Logo
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      PNG is recommended. Black and white usually looks cleaner.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setBranding((currentValue) => ({
                        ...currentValue,
                        logo_enabled: !currentValue.logo_enabled,
                      }))
                    }
                    className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${
                      branding.logo_enabled
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {branding.logo_enabled ? "Logo On" : "Logo Off"}
                  </button>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Upload Logo
                    </label>
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={handleLogoChange}
                      className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                    />
                    <div className="mt-2 text-xs text-slate-500">
                      Max recommended width: 320px
                    </div>
                  </div>

                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Logo Preview
                    </div>
                    {branding.logo_image ? (
                      <div className="mt-4 text-center">
                        <img
                          src={branding.logo_image}
                          alt="Login logo preview"
                          className="mx-auto max-h-24 max-w-[240px] object-contain"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setBranding((currentValue) => ({
                              ...currentValue,
                              logo_enabled: false,
                              logo_image: "",
                            }));
                            setSaveState("idle");
                          }}
                          className="mt-4 rounded-lg bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-200"
                        >
                          Remove Logo
                        </button>
                      </div>
                    ) : (
                      <div className="mt-3 text-sm text-slate-500">
                        Upload a logo to preview it here.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-sm text-slate-500">
                  Save once and the login screen will use this logo.
                </div>
                <button
                  type="button"
                  onClick={saveBranding}
                  disabled={saveState === "saving"}
                  className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  {saveState === "saving"
                    ? "Saving..."
                    : "Save Login Branding"}
                </button>
              </div>
            </div>

            <LoginCardPreview branding={branding} />
          </div>
        </div>
      </div>
    </AppSidebarLayout>
  );
}
