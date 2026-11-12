// The player panel: one screen to pick the subtitle language (among the tracks of the stream that is playing) and the
// maximum quality. The panel's values live in Kino's per-plugin store (scope "plugin"); `reconcile` copies them into the
// kino.storage override at the start of every panel call and a change writes it at once, so the next resolve sees either.
// Nothing here touches the stream that is playing. The panel always answers; playback never depends on it.

import { both, t } from "../i18n.js";
import { QUALITIES, readSettings } from "../settings.js";
import { readLangs, readPrefs, writePrefs, clearPrefs } from "./state.js";

const MAX_LANG_CHARS = 20;
const KEYS = ["preferredSubLang", "maxQuality"];

const label = (m) => ({ label: m.es, labelEn: m.en });
const isLang = (v) => typeof v === "string" && v.length > 0 && v.length <= MAX_LANG_CHARS;

const qualityLabel = (q) => (q === "auto" ? both("qAuto") : q === "480p" ? both("qUpTo480") : both("qUpTo", { v: q }));

/** The tracks to offer: the stream's, plus the language already chosen so the select always shows it. */
function langOptions(tracks, current) {
  const seen = new Set();
  const out = [];
  for (const x of [...tracks, { lang: current, label: current }]) {
    if (!seen.has(x.lang)) { seen.add(x.lang); out.push({ value: x.lang, label: x.label, labelEn: x.label }); }
  }
  return out;
}

/** The panel's saved values win over a different stored override; none left means the person reset elsewhere. Never throws. */
function reconcile(kino, ctx) {
  try {
    const v = ctx && ctx.values && ctx.values.plugin;
    if (!v || typeof v !== "object") return;
    if (!KEYS.some((k) => k in v)) { clearPrefs(kino); return; }
    const patch = {};
    if (isLang(v.preferredSubLang)) patch.preferredSubLang = v.preferredSubLang;
    if (QUALITIES.includes(v.maxQuality)) patch.maxQuality = v.maxQuality;
    const stored = readPrefs(kino);
    if (Object.keys(patch).some((k) => stored[k] !== patch[k])) writePrefs(kino, patch);
  } catch (_) { /* the override stays as it was */ }
}

export async function panel(ctx) {
  const kino = globalThis.kino;
  ctx = ctx || {};
  reconcile(kino, ctx);
  const current = readSettings(kino);
  const tracks = readLangs(kino, ctx.ref);
  const now = both("prefNow", { lang: current.preferredSubLang, quality: (l) => qualityLabel(current.maxQuality)[l] });
  const elements = [{ type: "text", text: now.es, textEn: now.en }];
  if (tracks.length) {
    elements.push({
      type: "select", key: "preferredSubLang", scope: "plugin", autoSave: true, ...label(both("prefSubLang")),
      value: current.preferredSubLang, options: langOptions(tracks, current.preferredSubLang),
    });
  } else {
    const none = both("prefNoTracks");
    elements.push({ type: "status", text: none.es, textEn: none.en });
  }
  elements.push({
    type: "select", key: "maxQuality", scope: "plugin", autoSave: true, ...label(both("prefMaxQuality")),
    value: current.maxQuality, options: QUALITIES.map((q) => ({ value: q, ...label(qualityLabel(q)) })),
  });
  const confirm = both("prefResetConfirm");
  elements.push({ type: "button", key: "reset", ...label(both("prefReset")), confirm: confirm.es, confirmEn: confirm.en });
  const note = both("prefApplies");
  elements.push({ type: "status", text: note.es, textEn: note.en });
  const title = t("panelTitle", { lang: "es" });
  return { title, titleEn: t("panelTitle", { lang: "en" }), elements };
}

/** The answer to a change of a preference or to "reset"; null when `ev` is neither. */
export async function panelAction(ev, ctx) {
  try {
    const kino = globalThis.kino;
    const key = ev && ev.key;
    if (key === "reset" && ev.trigger === "press") {
      clearPrefs(kino);
      return { values: { preferredSubLang: null, maxQuality: null }, save: KEYS };
    }
    if (!ev || ev.trigger !== "change") return null;
    if (key === "preferredSubLang" && isLang(ev.value)) writePrefs(kino, { preferredSubLang: ev.value });
    else if (key === "maxQuality" && QUALITIES.includes(ev.value)) writePrefs(kino, { maxQuality: ev.value });
    else return null;
    const lang = ctx && typeof ctx.lang === "string" ? ctx.lang : kino.lang;
    return { values: { [key]: ev.value }, save: [key], message: t("prefSaved", { lang }) };
  } catch (_) {
    return null;
  }
}

/** `playerEvent(event)`: the panel has nothing to record; the hook answers so Kino keeps the capability. */
export async function playerEvent() {
  return null;
}
