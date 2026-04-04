import { useEffect, useState } from "react";
import axios from "axios";
import AppSidebarLayout from "../components/AppSidebarLayout";
import { getStoredUser } from "../lib/accessControl";
import { API } from "../lib/api";

const MAIL_CONFIG_CACHE_KEY = "mail_configuration_cache_v1";

function createEmptyMailConfig() {
  return {
    smtp_host: "",
    smtp_port: 587,
    smtp_username: "",
    smtp_password: "",
    smtp_from_email: "",
    smtp_from_name: "",
    smtp_use_auth: true,
    smtp_use_tls: true,
    smtp_use_ssl: false,
    default_recipients: [],
    updated_at: null,
  };
}

function normalizeEmailList(values) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const nextEmails = [];

  values.forEach((value) => {
    const normalizedValue = String(value || "").trim();

    if (!normalizedValue || !emailPattern.test(normalizedValue)) {
      return;
    }

    const loweredValue = normalizedValue.toLowerCase();

    if (nextEmails.some((item) => item.toLowerCase() === loweredValue)) {
      return;
    }

    nextEmails.push(normalizedValue);
  });

  return nextEmails;
}

function parseEmailsFromInput(value) {
  return normalizeEmailList(String(value || "").split(/[\s,;]+/));
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

function isNetworkError(error) {
  return error?.code === "ERR_NETWORK" || error?.message === "Network Error";
}

function buildCacheableMailConfig(config) {
  return {
    ...createEmptyMailConfig(),
    ...(config || {}),
    smtp_password: "",
  };
}

function readCachedMailConfig() {
  if (typeof window === "undefined") {
    return createEmptyMailConfig();
  }

  try {
    const rawValue = window.localStorage.getItem(MAIL_CONFIG_CACHE_KEY);

    if (!rawValue) {
      return createEmptyMailConfig();
    }

    return buildCacheableMailConfig(JSON.parse(rawValue));
  } catch (error) {
    console.warn("Failed to read cached mail configuration", error);
    return createEmptyMailConfig();
  }
}

function writeCachedMailConfig(config) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      MAIL_CONFIG_CACHE_KEY,
      JSON.stringify(buildCacheableMailConfig(config)),
    );
  } catch (error) {
    console.warn("Failed to cache mail configuration", error);
  }
}

function getPreferredTestRecipient(config) {
  return (
    config?.default_recipients?.[0] ||
    config?.smtp_from_email ||
    config?.smtp_username ||
    ""
  );
}

function EmailListEditor({
  label,
  helper,
  emails,
  inputValue,
  onInputChange,
  onAdd,
  onRemove,
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <p className="mt-2 text-sm text-slate-500">{helper}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {emails.length > 0 ? (
          emails.map((email) => (
            <div
              key={email}
              className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm text-slate-700 shadow-sm"
            >
              <span>{email}</span>
              <button
                type="button"
                onClick={() => onRemove(email)}
                className="text-slate-400 hover:text-rose-600"
              >
                x
              </button>
            </div>
          ))
        ) : (
          <div className="text-sm text-slate-400">No email addresses added.</div>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          value={inputValue}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder="Enter email and click Add"
          className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-500"
        />
        <button
          type="button"
          onClick={onAdd}
          className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Add Email
        </button>
      </div>
    </div>
  );
}

export default function MailConfigurationPage() {
  const { role } = getStoredUser();
  const [mailConfig, setMailConfig] = useState(() => readCachedMailConfig());
  const [defaultRecipientInput, setDefaultRecipientInput] = useState("");
  const [testRecipientInput, setTestRecipientInput] = useState(() =>
    getPreferredTestRecipient(readCachedMailConfig()),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTestMail, setSendingTestMail] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [offlineNotice, setOfflineNotice] = useState("");

  const loadMailConfiguration = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/reports/mail-config`);
      const nextConfig = {
        ...createEmptyMailConfig(),
        ...(response.data || {}),
      };
      setLoadError("");
      setOfflineNotice("");
      setMailConfig(nextConfig);
      setTestRecipientInput((currentValue) =>
        currentValue || getPreferredTestRecipient(nextConfig),
      );
      writeCachedMailConfig(nextConfig);
    } catch (error) {
      console.error(error);
      setMailConfig(readCachedMailConfig());

      if (isNetworkError(error)) {
        setLoadError("");
        setOfflineNotice(
          "Backend is not connected right now. Showing local values on this page.",
        );
      } else {
        setOfflineNotice("");
        setLoadError(
          getErrorMessage(error, "Failed to load saved mail configuration."),
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMailConfiguration();
  }, []);

  const addEmailsToConfig = (inputValue, currentEmails, key, clearInput) => {
    const nextEmails = normalizeEmailList([
      ...currentEmails,
      ...parseEmailsFromInput(inputValue),
    ]);

    if (nextEmails.length === currentEmails.length) {
      alert("Enter at least one valid email address");
      return;
    }

    setMailConfig((currentValue) => ({
      ...currentValue,
      [key]: nextEmails,
    }));
    clearInput("");
  };

  const removeEmailFromConfig = (email, currentEmails, key) => {
    setMailConfig((currentValue) => ({
      ...currentValue,
      [key]: currentEmails.filter((value) => value !== email),
    }));
  };

  const saveConfiguration = async () => {
    try {
      setSaving(true);
      const response = await axios.put(`${API}/reports/mail-config`, mailConfig);

      if (response.data?.error) {
        alert(response.data.error);
        return;
      }

      const nextConfig = {
        ...createEmptyMailConfig(),
        ...(response.data || {}),
      };
      setMailConfig(nextConfig);
      setTestRecipientInput((currentValue) =>
        currentValue || getPreferredTestRecipient(nextConfig),
      );
      writeCachedMailConfig(nextConfig);
      setOfflineNotice("");
      alert("Mail configuration saved");
    } catch (error) {
      console.error(error);
      alert(getErrorMessage(error, "Failed to save mail configuration"));
    } finally {
      setSaving(false);
    }
  };

  const sendTestMail = async () => {
    try {
      setSendingTestMail(true);
      const response = await axios.post(`${API}/reports/test-email`, {
        ...mailConfig,
        test_recipient: testRecipientInput.trim(),
      });

      if (response.data?.error) {
        alert(response.data.error);
        return;
      }

      alert(response.data?.message || "Test email sent");
    } catch (error) {
      console.error(error);
      alert(getErrorMessage(error, "Failed to send test email"));
    } finally {
      setSendingTestMail(false);
    }
  };

  return (
    <AppSidebarLayout
      role={role}
      currentPage="mail-configuration"
      onRefresh={loadMailConfiguration}
    >
      <div className="space-y-6">
        <div className="rounded-[32px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_55%,#edf6ff_100%)] px-6 py-6 shadow-[0_24px_50px_-30px_rgba(15,23,42,0.55)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
                Administration
              </div>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">
                Mail Configuration
              </h1>
              <p className="mt-2 max-w-4xl text-sm text-slate-500">
                Configure SMTP, sender identity, and default recipients from
                this page.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
              {loading
                ? "Loading configuration..."
                : offlineNotice
                  ? "Using local values"
                : loadError
                  ? "Using default values"
                : "Saved mail settings ready to edit."}
            </div>
          </div>
        </div>

        {loadError ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            <div>
              <div className="font-semibold">Mail configuration could not be loaded.</div>
              <div className="mt-1 text-amber-800">{loadError}</div>
            </div>
            <button
              type="button"
              onClick={() => void loadMailConfiguration()}
              disabled={loading}
              className="rounded-2xl bg-amber-600 px-4 py-3 font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Retrying..." : "Retry Load"}
            </button>
          </div>
        ) : null}

        <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-bold text-slate-900">SMTP Settings</h2>
            <p className="mt-1 text-sm text-slate-500">
              These settings are used for manual and automatic report emails.
            </p>
          </div>
          <div className="space-y-4 p-5">
            <div className="grid gap-3 md:grid-cols-2">
              <input
                placeholder="SMTP Host"
                value={mailConfig.smtp_host}
                onChange={(event) =>
                  setMailConfig((currentValue) => ({
                    ...currentValue,
                    smtp_host: event.target.value,
                  }))
                }
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-500"
              />
              <input
                type="number"
                min="1"
                placeholder="SMTP Port"
                value={mailConfig.smtp_port}
                onChange={(event) =>
                  setMailConfig((currentValue) => ({
                    ...currentValue,
                    smtp_port: Number(event.target.value || 0),
                  }))
                }
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-500"
              />
              <input
                placeholder="SMTP Username"
                value={mailConfig.smtp_username}
                onChange={(event) =>
                  setMailConfig((currentValue) => ({
                    ...currentValue,
                    smtp_username: event.target.value,
                  }))
                }
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-500"
              />
              <input
                type="password"
                placeholder="SMTP Password"
                value={mailConfig.smtp_password}
                onChange={(event) =>
                  setMailConfig((currentValue) => ({
                    ...currentValue,
                    smtp_password: event.target.value,
                  }))
                }
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-500"
              />
              <input
                placeholder="Sender Email"
                value={mailConfig.smtp_from_email}
                onChange={(event) =>
                  setMailConfig((currentValue) => ({
                    ...currentValue,
                    smtp_from_email: event.target.value,
                  }))
                }
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-500"
              />
              <input
                placeholder="Sender Name"
                value={mailConfig.smtp_from_name}
                onChange={(event) =>
                  setMailConfig((currentValue) => ({
                    ...currentValue,
                    smtp_from_name: event.target.value,
                  }))
                }
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-500"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <button
                type="button"
                onClick={() =>
                  setMailConfig((currentValue) => ({
                    ...currentValue,
                    smtp_use_auth: !currentValue.smtp_use_auth,
                  }))
                }
                className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
                  mailConfig.smtp_use_auth
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                SMTP Auth {mailConfig.smtp_use_auth ? "On" : "Off"}
              </button>
              <button
                type="button"
                onClick={() =>
                  setMailConfig((currentValue) => ({
                    ...currentValue,
                    smtp_use_tls: !currentValue.smtp_use_tls,
                    smtp_use_ssl: false,
                  }))
                }
                className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
                  mailConfig.smtp_use_tls && !mailConfig.smtp_use_ssl
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                TLS {mailConfig.smtp_use_tls && !mailConfig.smtp_use_ssl ? "On" : "Off"}
              </button>
              <button
                type="button"
                onClick={() =>
                  setMailConfig((currentValue) => ({
                    ...currentValue,
                    smtp_use_ssl: !currentValue.smtp_use_ssl,
                    smtp_use_tls: currentValue.smtp_use_ssl
                      ? currentValue.smtp_use_tls
                      : false,
                  }))
                }
                className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
                  mailConfig.smtp_use_ssl
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                SSL {mailConfig.smtp_use_ssl ? "On" : "Off"}
              </button>
            </div>

            <p className="text-sm text-slate-500">
              Turn off SMTP Auth if your mail server sends without login and does
              not support the AUTH extension.
            </p>
          </div>
        </div>

        <EmailListEditor
          label="Default Recipients"
          helper="These addresses are used by default when sending reports by email."
          emails={mailConfig.default_recipients}
          inputValue={defaultRecipientInput}
          onInputChange={setDefaultRecipientInput}
          onAdd={() =>
            addEmailsToConfig(
              defaultRecipientInput,
              mailConfig.default_recipients,
              "default_recipients",
              setDefaultRecipientInput,
            )
          }
          onRemove={(email) =>
            removeEmailFromConfig(
              email,
              mailConfig.default_recipients,
              "default_recipients",
            )
          }
        />

        <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-bold text-slate-900">Test Mail</h2>
            <p className="mt-1 text-sm text-slate-500">
              Send a test email using the current mail configuration and show the
              exact SMTP error if anything is wrong.
            </p>
          </div>
          <div className="grid gap-3 p-5 md:grid-cols-[minmax(0,1fr)_220px]">
            <input
              value={testRecipientInput}
              onChange={(event) => setTestRecipientInput(event.target.value)}
              placeholder="Test recipient email"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-500"
            />
            <button
              type="button"
              onClick={() => void sendTestMail()}
              disabled={sendingTestMail}
              className="rounded-2xl bg-gradient-to-br from-sky-500 via-cyan-500 to-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-200/80 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {sendingTestMail ? "Sending Test..." : "Send Test Mail"}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void saveConfiguration()}
            disabled={saving}
            className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? "Saving..." : "Save Mail Configuration"}
          </button>
        </div>
      </div>
    </AppSidebarLayout>
  );
}
