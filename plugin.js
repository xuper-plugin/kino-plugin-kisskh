// src/i18n.js
var WORDS = {
  es: {
    notFound: "No encontr\xE9 este t\xEDtulo en KissKH.",
    tabHome: "Inicio",
    tabDramas: "Dramas",
    tabMovies: "Pel\xEDculas",
    tabAnime: "Anime",
    rowLatest: "Novedades",
    rowSeries: "Dramas",
    rowMovies: "Pel\xEDculas",
    rowAnime: "Anime",
    catDramas: "Dramas",
    catMovies: "Pel\xEDculas",
    catAnime: "Anime",
    catHollywood: "Hollywood",
    unavailable: "KissKH no est\xE1 disponible ahora. Intenta de nuevo en un rato."
  },
  en: {
    notFound: "I could not find this title on KissKH.",
    tabHome: "Home",
    tabDramas: "Dramas",
    tabMovies: "Movies",
    tabAnime: "Anime",
    rowLatest: "New releases",
    rowSeries: "Dramas",
    rowMovies: "Movies",
    rowAnime: "Anime",
    catDramas: "Dramas",
    catMovies: "Movies",
    catAnime: "Anime",
    catHollywood: "Hollywood",
    unavailable: "KissKH is not available right now. Try again in a while."
  }
};
function langOf(kino = globalThis.kino) {
  return String(kino && kino.lang || "").toLowerCase().startsWith("en") ? "en" : "es";
}
function t(key, kino = globalThis.kino) {
  const words = WORDS[langOf(kino)];
  return words[key] ?? WORDS.es[key] ?? key;
}
var KEYS = { es: Object.keys(WORDS.es), en: Object.keys(WORDS.en) };

// src/util/http.js
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
var ORIGIN = "https://kisskh.do";
var get = (url, kino = globalThis.kino) => kino.fetch(url, { headers: { "User-Agent": UA, Referer: ORIGIN + "/", Accept: "application/json" } });
async function getJson(url, kino = globalThis.kino) {
  const r = await get(url, kino);
  try {
    return r.json();
  } catch (_) {
    throw kino.error("unavailable", `non-JSON body (status ${r.status}) from ${url}`, { userMessage: t("unavailable", kino) });
  }
}

// src/api.js
var API = ORIGIN + "/api/DramaList";
var item = (d) => ({
  id: d.id,
  title: String(d.title ?? ""),
  thumbnail: String(d.thumbnail ?? ""),
  episodesCount: d.episodesCount | 0,
  label: String(d.label ?? "")
});
async function list({ page = 1, type = 0, country = 0, status = 0, order = 1, pageSize = 24 } = {}) {
  const j = await getJson(`${API}/List?page=${page}&type=${type}&sub=0&country=${country}&status=${status}&order=${order}&pageSize=${pageSize}`);
  return { page: j.page, pageSize: j.pageSize, totalCount: j.totalCount, items: (j.data || []).map(item) };
}

// src/catalog.js
var ROW_CAP = 24;
var MAX_PAGE = 2e3;
var LATEST = 1;
var listRef = (type, country = 0, status = 0, order = LATEST) => `list:${type}:${country}:${status}:${order}`;
var GENRES = {
  dramas: { type: 1, titleKey: "catDramas" },
  movies: { type: 2, titleKey: "catMovies" },
  anime: { type: 3, titleKey: "catAnime" },
  hollywood: { type: 4, titleKey: "catHollywood" }
};
function dress(item2) {
  return {
    ref: "d:" + item2.id,
    title: item2.title,
    poster: item2.thumbnail,
    kind: item2.episodesCount <= 1 ? "movie" : "series",
    episodesCount: item2.episodesCount
  };
}
function parseRef(ref) {
  const s = String(ref || "");
  const l = /^list:(\d{1,2}):(\d{1,3}):(\d{1,3}):(\d{1,2})$/.exec(s);
  if (l) return { type: +l[1], country: +l[2], status: +l[3], order: +l[4] };
  const g = /^genre:([a-z]+)$/.exec(s);
  if (g && Object.prototype.hasOwnProperty.call(GENRES, g[1])) return { type: GENRES[g[1]].type, country: 0, status: 0, order: LATEST };
  return null;
}
async function browse(kino, ref, cursor) {
  const q = parseRef(ref);
  if (!q) throw kino.error("not_found", "unknown browse ref");
  const n = Number.parseInt(cursor, 10);
  const page = n >= 1 && n <= MAX_PAGE ? n : 1;
  const r = await list({ ...q, page });
  const items = r.items.map(dress);
  return items.length && page < MAX_PAGE && page * r.pageSize < r.totalCount ? { items, cursor: String(page + 1) } : { items };
}
async function row(titleKey, kino, q) {
  const r = await list({ ...q, page: 1 });
  const items = r.items.map(dress).slice(0, ROW_CAP);
  return items.length ? { title: t(titleKey, kino), items, ref: listRef(q.type, q.country, q.status, q.order) } : null;
}
var TYPE_ROWS = [
  ["rowSeries", 1],
  ["rowMovies", 2],
  ["rowAnime", 3]
];
async function homeRows(kino) {
  const defs = [["rowLatest", 0], ...TYPE_ROWS];
  const rows = await Promise.all(defs.map(([key, type]) => row(key, kino, { type, order: LATEST }).catch((e) => {
    kino.log("[kisskh]", "row", key, e && e.code || "error");
    return null;
  })));
  return rows.filter(Boolean);
}
async function home(kino, settings) {
  return settings.homeRows ? homeRows(kino) : [];
}
var TABS = [
  { id: "inicio", labelKey: "tabHome" },
  { id: "dramas", labelKey: "tabDramas", type: 1 },
  { id: "peliculas", labelKey: "tabMovies", type: 2 },
  { id: "anime", labelKey: "tabAnime", type: 3 }
];
var foldTab = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
async function section(kino, settings, tab) {
  const chosen = TABS.find((x) => x.id === foldTab(tab)) || TABS[0];
  const rows = chosen.type ? [await row("rowLatest", kino, { type: chosen.type, order: LATEST })].filter(Boolean) : await homeRows(kino);
  return { tabs: TABS.map((x) => ({ id: x.id, label: t(x.labelKey, kino) })), tab: chosen.id, rows };
}
function categories(kino) {
  return Object.entries(GENRES).map(([key, g]) => ({ id: key, title: t(g.titleKey, kino), ref: "genre:" + key }));
}

// src/plugin.js
var getKino = () => globalThis.kino;
var unavailable = (what) => {
  const kino = getKino();
  return kino.error("unavailable", `${what}: not implemented yet`, { userMessage: t("unavailable", kino) });
};
async function search() {
  return [];
}
var readSettings = (kino) => {
  let v;
  try {
    v = kino.config.get("homeRows");
  } catch (_) {
  }
  return { homeRows: !(v === false || v === "false") };
};
async function home2() {
  const kino = getKino();
  return home(kino, readSettings(kino));
}
async function browse2(ref, cursor) {
  return browse(getKino(), ref, cursor);
}
async function section2(arg) {
  const kino = getKino();
  return section(kino, readSettings(kino), arg && arg.tab);
}
async function categories2() {
  return categories(getKino());
}
async function episodes() {
  return [];
}
async function details() {
  throw unavailable("details");
}
async function resolve() {
  throw unavailable("resolve");
}
async function settingsStatus() {
  return {};
}
async function action() {
  return null;
}
async function validateSettings() {
  return null;
}
async function panel() {
  return null;
}
async function panelAction() {
  return null;
}
async function playerEvent() {
  return null;
}
export {
  action,
  browse2 as browse,
  categories2 as categories,
  details,
  episodes,
  home2 as home,
  panel,
  panelAction,
  playerEvent,
  resolve,
  search,
  section2 as section,
  settingsStatus,
  validateSettings
};
