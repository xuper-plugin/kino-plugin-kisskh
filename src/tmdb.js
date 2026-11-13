// Best-effort TMDB enrichment through kino.tmdb (Kino's own proxy: no key, no capability). A title is matched to its TMDB
// id by name and year (the match is kept in kino.storage), and the id gives Kino's detail page its cast, overview and
// backdrop and the home hero its logo. Every function answers null instead of throwing: without kino.tmdb, on a
// failure or a slow answer the plugin simply shows what it already had.

import { slugify } from "./util/slug.js";

const IMG = "https://image.tmdb.org/t/p/";
const LOGO_SIZE = "w500";
const HIT_TTL_MS = 30 * 24 * 3600 * 1000;
const MISS_TTL_MS = 24 * 3600 * 1000;
/** Longest wait for one kino.tmdb answer, so a hanging TMDB never stalls a screen draw. */
export const CALL_MS = 3000;
/** Longest wait for a hero's id and logo together. */
export const LOGO_MS = 5000;

const yearOf = (d) => (typeof d === "string" && /^\d{4}/.test(d) ? Number(d.slice(0, 4)) : null);
const kindOf = (kind) => (kind === "movie" ? "movie" : "tv");

/** `run()`'s value, or a thrown error once [ms] pass (QuickJS has no setTimeout: the wait is kino.sleep in short steps). */
async function bounded(kino, run, ms) {
  await null;
  let settled = false;
  const work = Promise.resolve().then(run).then((v) => { settled = true; return { v }; }, (e) => { settled = true; return { e }; });
  const end = Date.now() + ms;
  const timer = (async () => {
    while (!settled && end > Date.now()) await kino.sleep(Math.min(250, end - Date.now()));
    return null;
  })();
  const r = await Promise.race([work, timer]);
  if (!r) throw new Error("tmdb: over " + ms + " ms");
  if (r.e) throw r.e;
  return r.v;
}

const ask = (kino, path, params) => bounded(kino, () => kino.tmdb(path, params), CALL_MS);
const has = (kino) => !!kino && typeof kino.tmdb === "function";

function recall(kino, key) {
  try { return kino.storage.get(key); } catch (_) { return null; /* no storage: ask again */ }
}
function remember(kino, key, value, ttlMs) {
  try { kino.storage.set(key, String(value), { ttlMs }); } catch (_) { /* full storage */ }
}

/** The TMDB result that is this title: same name (any of its names) and year within one; else null. */
function pick(results, names, year) {
  const wanted = new Set(names.map(slugify).filter(Boolean));
  const near = (r) => {
    const y = yearOf(r.release_date || r.first_air_date);
    return !year || !y || Math.abs(y - year) <= 1;
  };
  const namesOf = (r) => [r.title, r.name, r.original_title, r.original_name].map(slugify).filter(Boolean);
  const list = (results || []).filter((r) => r && Number.isInteger(r.id) && near(r));
  const exact = [...new Set(list.filter((r) => namesOf(r).some((n) => wanted.has(n))).map((r) => r.id))];
  // Two titles with this exact name and no year to tell them apart: neither is sure.
  if (exact.length > 1 && !year) return null;
  return exact.length ? exact[0] : null;
}

/** The title as the site prints it and without a trailing "(2024)" year. */
const nameVariants = (title) => {
  const raw = String(title || "").trim();
  return [...new Set([raw, raw.replace(/\s*\(\d{4}\)\s*$/, "").trim()].filter(Boolean))];
};

/**
 * The TMDB id of `{ title, year, kind }` ("movie" or "series"), or null when TMDB has no title that is clearly this one,
 * kino.tmdb is missing or it fails. Hits are remembered 30 days, misses one day, failures not at all.
 */
export async function matchTmdb(kino, { title, year, kind }) {
  if (!has(kino)) return null;
  const names = nameVariants(title);
  if (!names.length) return null;
  const k = kindOf(kind);
  const query = names[names.length - 1];
  const key = `tmdb:${k}:${slugify(query)}:${year || ""}`;
  const cached = recall(kino, key);
  if (cached === "none") return null;
  if (cached && /^\d+$/.test(cached)) return Number(cached);
  try {
    // Asian titles are often translated or in their own script in es-MX: English is tried when Spanish misses.
    for (const language of ["es-MX", "en-US"]) {
      const r = await ask(kino, `/search/${k}`, { query, language, include_adult: false });
      const id = pick(r && r.results, names, year);
      if (id) {
        remember(kino, key, id, HIT_TTL_MS);
        return id;
      }
    }
    remember(kino, key, "none", MISS_TTL_MS);
    return null;
  } catch (e) {
    kino.log("[kisskh]", "tmdb match", (e && e.code) || "error");
    return null;
  }
}

/** The best logo of a TMDB images answer: Spanish first, then English, then one with no language. */
function bestLogo(logos) {
  const list = (logos || []).filter((l) => l && typeof l.file_path === "string" && l.file_path.startsWith("/"));
  for (const lang of ["es", "en", null]) {
    const hit = list.find((l) => (l.iso_639_1 || null) === lang);
    if (hit) return IMG + LOGO_SIZE + hit.file_path;
  }
  return null;
}

/** A logo image URL for TMDB title [id] ("movie" or "series"), or null. Remembered like a match. */
export async function logoUrl(kino, id, kind) {
  if (!has(kino) || !Number.isInteger(id)) return null;
  const k = kindOf(kind);
  const key = `tmdbLogo:${k}:${id}`;
  const cached = recall(kino, key);
  if (cached === "none") return null;
  if (cached && cached.startsWith(IMG)) return cached;
  try {
    const d = await ask(kino, `/${k}/${id}`, { append_to_response: "images", include_image_language: "es,en,null" });
    const url = bestLogo(d && d.images && d.images.logos);
    remember(kino, key, url || "none", url ? HIT_TTL_MS : MISS_TTL_MS);
    return url;
  } catch (e) {
    kino.log("[kisskh]", "tmdb logo", (e && e.code) || "error");
    return null;
  }
}

/** The logo of `{ title, year, kind }`: its id matched, then its images, together within [LOGO_MS]; null on any miss. */
export async function titleLogo(kino, query) {
  if (!has(kino)) return null;
  try {
    return await bounded(kino, async () => {
      const id = await matchTmdb(kino, query);
      return id ? logoUrl(kino, id, query.kind) : null;
    }, LOGO_MS);
  } catch (_) {
    return null;
  }
}
