export const DEFAULT_LOGIN_BRANDING = {
  logo_enabled: false,
  logo_image: "",
  updated_at: null,
};

const LOGIN_BRANDING_STORAGE_KEY = "login_branding_settings";

export function normalizeLoginBranding(rawValue) {
  const baseValue = {
    ...DEFAULT_LOGIN_BRANDING,
    ...(rawValue || {}),
  };

  return {
    logo_enabled: Boolean(baseValue.logo_enabled),
    logo_image: String(baseValue.logo_image || ""),
    updated_at: baseValue.updated_at || null,
  };
}

export function readStoredLoginBranding() {
  if (typeof window === "undefined") {
    return DEFAULT_LOGIN_BRANDING;
  }

  try {
    const rawValue = window.localStorage.getItem(LOGIN_BRANDING_STORAGE_KEY);

    if (!rawValue) {
      return DEFAULT_LOGIN_BRANDING;
    }

    return normalizeLoginBranding(JSON.parse(rawValue));
  } catch {
    return DEFAULT_LOGIN_BRANDING;
  }
}

export function writeStoredLoginBranding(settings) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    LOGIN_BRANDING_STORAGE_KEY,
    JSON.stringify(normalizeLoginBranding(settings)),
  );
}
