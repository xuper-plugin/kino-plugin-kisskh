// KissKH: thin wiring of every export Kino calls; the logic lives in the modules.
import { t, tf } from "./i18n.js";
import * as catalog from "./catalog.js";
import * as detail from "./detail.js";
import * as playback from "./resolve.js";
import { videoUrl } from "./resolve.js";
import { list } from "./api.js";
import { readSettings, validateSettings as validate, VALUE_KEYS } from "./settings.js";
import { healthLine, recordProbe } from "./health.js";
import { buildScreen, handleEvent } from "./screen.js";
import { clearPrefs, LAST_PREFIX, LATEST_KEY } from "./panel/state.js";

// Kino waits for a plugin's in-flight requests before it answers; with this flag it drops the ones nobody awaits,
// so a slow rail cannot make Home or the screen time out. Every fetch here is awaited by its caller (resolve and
// subtitles included), so the flag only ever drops stragglers.
globalThis.__kinoDropPendingFetches = true;

const getKino = () => globalThis.kino;

/** `search(query)`: the site's matches; inside a "Ver más" page (scopedSearch, `query.within`), that page's matching titles. */
export async function search(query) {
  const kino = getKino();
  const q = typeof query === "string" ? query : (query && query.q) || "";
  if (query && typeof query === "object" && query.within) return catalog.searchWithin(kino, query.within, q, query.cursor);
  return catalog.search(kino, q, query && query.type);
}

/** `home()`: the rows shown on Kino's Home. */
export async function home() {
  const kino = getKino();
  return catalog.home(kino, readSettings(kino));
}

/** `browse(ref, cursor)`: a "Ver más" page of a row or a category tile. */
export async function browse(ref, cursor) {
  return catalog.browse(getKino(), ref, cursor);
}

/** `section({ tab })`: the plugin's own section. */
export async function section(arg) {
  const kino = getKino();
  return catalog.section(kino, readSettings(kino), arg && arg.tab);
}

/** `screen({ state })`: the plugin's own canvas (logo, featured carousel, tabs, country chips, rails). */
export async function screen(ctx) {
  return buildScreen(getKino(), (ctx && ctx.state) || {});
}

/** `screenEvent(event)`: a tab or country change patches the state; Kino draws the screen again. */
export async function screenEvent(event) {
  return handleEvent(event);
}

/** `categories()`: genre tiles. */
export async function categories() {
  return catalog.categories(getKino());
}

/** `episodes(ref)`: a series' episodes. */
export async function episodes(ref) {
  return detail.episodes(getKino(), ref);
}

/** `details(ref)`: a title's detail page. */
export async function details(ref) {
  return detail.details(getKino(), ref);
}

/** `resolve(ref)`: the Stream to play. */
export async function resolve(ref) {
  return playback.resolve(getKino(), ref);
}

// ---------- settings form ----------

const PROBE_EPISODE = 174941; // a known episode: the signer and the Episode endpoint answer for it

/** `settingsStatus()`: the "health" line. */
export async function settingsStatus() {
  const kino = getKino();
  return { health: healthLine(kino) };
}

/** Asks the catalogue API and signs + fetches a known Episode, past any cache; the results land in the health line. */
async function probe(kino) {
  const ok = async (ask) => {
    try {
      await ask();
      return true;
    } catch (_) {
      return false;
    }
  };
  const health = {
    api: await ok(() => list({ pageSize: 1 })),
    signer: await ok(() => videoUrl(kino, PROBE_EPISODE)),
  };
  recordProbe(kino, health);
  const state = (v) => t(v ? "healthOk" : "healthFail", kino);
  return { message: tf("probeDone", { api: state(health.api), signer: state(health.signer) }, kino) };
}

/** Removes only what can be fetched again: the panel's per-stream records (pp:last:*, pp:latest). */
function clearCache(kino) {
  let n = 0;
  for (const key of kino.storage.keys()) {
    if (key === LATEST_KEY || key.startsWith(LAST_PREFIX)) { kino.storage.remove(key); n++; }
  }
  return { message: n === 1 ? t("cacheClearedOne", kino) : tf("cacheCleared", { n }, kino) };
}

/** `action(key)`: the form's buttons -- probe, clearCache, resetPrefs. */
export async function action(key) {
  const kino = getKino();
  if (key === "probe") return probe(kino);
  if (key === "clearCache") return clearCache(kino);
  if (key === "resetPrefs") {
    clearPrefs(kino);
    return { message: t("prefsReset", kino), clearSettings: VALUE_KEYS };
  }
  return null;
}

/** `validateSettings(values)`: null when the form's values are acceptable. */
export async function validateSettings(values) {
  return validate(getKino(), values);
}

export { panel, panelAction, playerEvent } from "./panel/index.js";
