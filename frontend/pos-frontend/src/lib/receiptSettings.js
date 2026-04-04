export const DEFAULT_RECEIPT_SETTINGS = {
  title_enabled: false,
  details_enabled: true,
  title_font_size: 18,
  logo_enabled: false,
  logo_image: "",
  logo_alignment: "CENTER",
  logo_size: "SMALL",
  logo_width: 200,
  header_text: "",
  header_alignment: "CENTER",
  header_font_size: 18,
  details_font_size: 12,
  item_font_size: 13,
  summary_font_size: 14,
  footer_enabled: true,
  footer_text: "THANK YOU VISIT AGAIN\nCONSUME WITHIN 1 HOUR",
  footer_alignment: "CENTER",
  footer_font_size: 12,
  item_layout: "COMPACT",
};

const RECEIPT_SETTINGS_STORAGE_KEY = "receipt_settings";

function normalizeAlignment(value) {
  const normalizedValue = String(value || "CENTER").trim().toUpperCase();
  return ["LEFT", "CENTER", "RIGHT"].includes(normalizedValue)
    ? normalizedValue
    : "CENTER";
}

function normalizeLogoSize(value) {
  const normalizedValue = String(value || "SMALL").trim().toUpperCase();
  return ["SMALL", "MEDIUM", "LARGE"].includes(normalizedValue)
    ? normalizedValue
    : "SMALL";
}

function getLegacyLogoWidth(value) {
  const normalizedValue = normalizeLogoSize(value);

  if (normalizedValue === "LARGE") {
    return 260;
  }

  if (normalizedValue === "MEDIUM") {
    return 200;
  }

  return 140;
}

function normalizeLogoWidth(value, fallbackValue = 200) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallbackValue;
  }

  return Math.min(Math.max(Math.round(numericValue), 80), 300);
}

function normalizeFontSize(value, fallbackValue = 13) {
  if (typeof value === "string") {
    const normalizedValue = value.trim().toUpperCase();

    if (normalizedValue === "SMALL") {
      return 11;
    }

    if (normalizedValue === "MEDIUM") {
      return 13;
    }

    if (normalizedValue === "LARGE") {
      return 18;
    }
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallbackValue;
  }

  return Math.min(Math.max(Math.round(numericValue), 9), 56);
}

function normalizeItemLayout(value) {
  const normalizedValue = String(value || "COMPACT").trim().toUpperCase();
  return ["COMPACT", "DETAILED"].includes(normalizedValue)
    ? normalizedValue
    : "COMPACT";
}

function readLegacyReceiptSettings() {
  if (typeof window === "undefined") {
    return DEFAULT_RECEIPT_SETTINGS;
  }

  const businessName =
    window.localStorage.getItem("receipt_business_name") ||
    window.localStorage.getItem("business_name") ||
    window.localStorage.getItem("shop_name") ||
    window.localStorage.getItem("restaurant_name") ||
    "";
  const businessPhone =
    window.localStorage.getItem("receipt_business_phone") ||
    window.localStorage.getItem("business_phone") ||
    window.localStorage.getItem("phone_number") ||
    "";
  const footerText =
    window.localStorage.getItem("receipt_footer_note") ||
    window.localStorage.getItem("receipt_footer") ||
    window.localStorage.getItem("business_footer_note") ||
    DEFAULT_RECEIPT_SETTINGS.footer_text;
  const logoImage =
    window.localStorage.getItem("receipt_logo_url") ||
    window.localStorage.getItem("business_logo_url") ||
    "";
  const headerLines = [businessName, businessPhone].filter(Boolean).join("\n");

  return {
    ...DEFAULT_RECEIPT_SETTINGS,
    title_enabled: false,
    details_enabled: true,
    title_font_size: 18,
    logo_enabled: Boolean(logoImage),
    logo_image: logoImage,
    header_text: headerLines,
    footer_text: footerText,
  };
}

export function normalizeReceiptSettings(rawValue) {
  const baseValue = {
    ...DEFAULT_RECEIPT_SETTINGS,
    ...(rawValue || {}),
  };

  return {
    title_enabled: Boolean(baseValue.title_enabled),
    details_enabled: Boolean(baseValue.details_enabled ?? true),
    title_font_size: normalizeFontSize(baseValue.title_font_size, 18),
    logo_enabled: Boolean(baseValue.logo_enabled),
    logo_image: String(baseValue.logo_image || ""),
    logo_alignment: normalizeAlignment(baseValue.logo_alignment),
    logo_size: normalizeLogoSize(baseValue.logo_size),
    logo_width: normalizeLogoWidth(
      baseValue.logo_width,
      getLegacyLogoWidth(baseValue.logo_size),
    ),
    header_text: String(baseValue.header_text || ""),
    header_alignment: normalizeAlignment(baseValue.header_alignment),
    header_font_size: normalizeFontSize(baseValue.header_font_size, 18),
    details_font_size: normalizeFontSize(baseValue.details_font_size, 12),
    item_font_size: normalizeFontSize(baseValue.item_font_size, 13),
    summary_font_size: normalizeFontSize(baseValue.summary_font_size, 14),
    footer_enabled: Boolean(baseValue.footer_enabled),
    footer_text: String(
      baseValue.footer_text || DEFAULT_RECEIPT_SETTINGS.footer_text,
    ),
    footer_alignment: normalizeAlignment(baseValue.footer_alignment),
    footer_font_size: normalizeFontSize(baseValue.footer_font_size, 12),
    item_layout: normalizeItemLayout(baseValue.item_layout),
  };
}

export function readStoredReceiptSettings() {
  if (typeof window === "undefined") {
    return DEFAULT_RECEIPT_SETTINGS;
  }

  const storedValue = window.localStorage.getItem(RECEIPT_SETTINGS_STORAGE_KEY);

  if (!storedValue) {
    return normalizeReceiptSettings(readLegacyReceiptSettings());
  }

  try {
    return normalizeReceiptSettings(JSON.parse(storedValue));
  } catch {
    return normalizeReceiptSettings(readLegacyReceiptSettings());
  }
}

export function writeStoredReceiptSettings(settings) {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedSettings = normalizeReceiptSettings(settings);
  window.localStorage.setItem(
    RECEIPT_SETTINGS_STORAGE_KEY,
    JSON.stringify(normalizedSettings),
  );
}
