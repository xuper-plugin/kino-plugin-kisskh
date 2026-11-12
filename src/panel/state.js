// Every kino.storage key the player panel uses, behind one module. Each read and write is guarded: a full, corrupt or
// unavailable storage gives defaults and never throws, so playback never depends on the panel.
//
//   pp:prefs       the panel's override { v:1, preferredSubLang?, maxQuality? } (read by readSettings)
//   pp:last:<ref>  the subtitle tracks the stream of <ref> carried { v:1, langs:[{ lang, label }] }
//   pp:latest      the ref of the newest record: the panel's ref may not be the one resolve got

const PREFS_KEY = "pp:prefs";
export const LAST_PREFIX = "pp:last:";
export const LATEST_KEY = "pp:latest";
const LAST_TTL_MS = 6 * 3600 * 1000;
const MAX_LANGS = 30;

const isStr = (x) => typeof x === "string";

function readJson(kino, key) {
  try {
    const v = JSON.parse(kino.storage.get(key) || "null");
    return v && typeof v === "object" && v.v === 1 ? v : null;
  } catch (_) {
    return null;
  }
}

function writeJson(kino, key, value, ttlMs) {
  try { kino.storage.set(key, JSON.stringify({ v: 1, ...value }), ttlMs ? { ttlMs } : undefined); } catch (_) { /* full storage: not kept */ }
}

/** The panel's override as stored: `{ preferredSubLang?, maxQuality? }`, `{}` when there is none. */
export function readPrefs(kino) {
  const p = readJson(kino, PREFS_KEY);
  const out = {};
  if (p && isStr(p.preferredSubLang)) out.preferredSubLang = p.preferredSubLang;
  if (p && isStr(p.maxQuality)) out.maxQuality = p.maxQuality;
  return out;
}

/** Merges `patch` into the override. */
export function writePrefs(kino, patch) {
  writeJson(kino, PREFS_KEY, { ...readPrefs(kino), ...patch });
}

export function clearPrefs(kino) {
  try { kino.storage.remove(PREFS_KEY); } catch (_) { /* nothing to clear */ }
}

/** Remembers the subtitle tracks `{ langs: [{ lang, label }] }` of the stream resolved for `ref`. */
export function writeLast(kino, ref, rec) {
  if (!isStr(ref) || !ref || !rec || !Array.isArray(rec.langs)) return;
  writeJson(kino, LATEST_KEY, { ref }, LAST_TTL_MS);
  writeJson(kino, LAST_PREFIX + ref, {
    langs: rec.langs.filter((x) => x && isStr(x.lang) && x.lang).slice(0, MAX_LANGS).map((x) => ({ lang: x.lang, label: isStr(x.label) ? x.label : x.lang })),
  }, LAST_TTL_MS);
}

/** The `[{ lang, label }]` of `ref`'s stream, else of the newest one; `[]` when none is known. */
export function readLangs(kino, ref) {
  let r = isStr(ref) && ref ? readJson(kino, LAST_PREFIX + ref) : null;
  if (!r) {
    const latest = readJson(kino, LATEST_KEY);
    r = latest && isStr(latest.ref) ? readJson(kino, LAST_PREFIX + latest.ref) : null;
  }
  return r && Array.isArray(r.langs) ? r.langs.filter((x) => x && isStr(x.lang)).map((x) => ({ lang: x.lang, label: isStr(x.label) ? x.label : x.lang })) : [];
}
