// Source health: the last probe's answer. kino.storage key `health` keeps { api, signer, at } (booleans: the catalogue
// API answered, the signed Episode lane returned a playable URL). The settings form shows it as one status line.

import { t } from "./i18n.js";

const KEY = "health";

/** The stored health, `{}` when there is none or it is unreadable. */
export function readHealth(kino) {
  try {
    const h = JSON.parse(kino.storage.get(KEY) || "{}");
    return h && typeof h === "object" && !Array.isArray(h) ? h : {};
  } catch (_) {
    return {};
  }
}

/** Records one probe's result `{ api, signer }`. */
export function recordProbe(kino, { api, signer }) {
  try { kino.storage.set(KEY, JSON.stringify({ api: !!api, signer: !!signer, at: Date.now() })); } catch (_) { /* full storage: the next probe records again */ }
}

/** "Catálogo ok · Reproducción falla": one line, one entry per part checked. */
export function healthLine(kino, health = readHealth(kino)) {
  const state = (ok) => t(typeof ok !== "boolean" ? "healthNone" : ok ? "healthOk" : "healthFail", kino);
  return `${t("healthApi", kino)} ${state(health.api)} · ${t("healthSigner", kino)} ${state(health.signer)}`;
}
