// The browsable side: KissKH's catalogue as Kino tiles, rows, "Ver más" pages, a section and category tiles.
//
// Refs (opaque, shared with details/episodes/resolve):
//   d:<dramaId>                                   a title (the tile's ref)
//   list:<type>:<country>:<status>:<order>        a browse page; type 0 all, 1 series, 2 movie, 3 anime, 4 Hollywood
//   genre:<key>                                   a category tile's page, the same list params under a name
//   e:<dramaId>:<episodeId>:<number>              a series episode (detail.js makes it, resolve reads it)
//   m:<dramaId>                                   a movie's play ref (resolve reads it)

import { list, search as siteSearch } from "./api.js";
import { t } from "./i18n.js";

const ROW_CAP = 24;
const MAX_PAGE = 2000;
const LATEST = 1; // the site's "newest first" order

const listRef = (type, country = 0, status = 0, order = LATEST) => `list:${type}:${country}:${status}:${order}`;

/** Category key -> list params. */
const GENRES = {
  dramas: { type: 1, titleKey: "catDramas" },
  movies: { type: 2, titleKey: "catMovies" },
  anime: { type: 3, titleKey: "catAnime" },
  hollywood: { type: 4, titleKey: "catHollywood" },
};

/** "d:<id>" -> the drama id (a string of digits), else null. */
export const titleId = (ref) => (/^d:(\d{1,9})$/.exec(String(ref || "")) || [])[1] || null;

/** A list item as Kino's tile. `kind` is a list-time guess (one episode: a movie); the detail's type settles it later. */
export function dress(item) {
  return {
    ref: "d:" + item.id,
    title: item.title,
    poster: item.thumbnail,
    kind: item.episodesCount <= 1 ? "movie" : "series",
    episodesCount: item.episodesCount,
  };
}

/** "list:t:c:s:o" or "genre:key" -> { type, country, status, order }, else null. */
function parseRef(ref) {
  const s = String(ref || "");
  const l = /^list:(\d{1,2}):(\d{1,3}):(\d{1,3}):(\d{1,2})$/.exec(s);
  if (l) return { type: +l[1], country: +l[2], status: +l[3], order: +l[4] };
  const g = /^genre:([a-z]+)$/.exec(s);
  if (g && Object.prototype.hasOwnProperty.call(GENRES, g[1])) return { type: GENRES[g[1]].type, country: 0, status: 0, order: LATEST };
  return null;
}

/** `browse(ref, cursor)`: one "Ver más" page, `cursor` the next page number (a string) while more exist. */
export async function browse(kino, ref, cursor) {
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

const TYPE_ROWS = [
  ["rowSeries", 1],
  ["rowMovies", 2],
  ["rowAnime", 3],
];

/** The rows of Inicio: the newest of everything, then of each type. Rows that fail or come back empty are left out. */
async function homeRows(kino) {
  const defs = [["rowLatest", 0], ...TYPE_ROWS];
  const rows = await Promise.all(defs.map(([key, type]) => row(key, kino, { type, order: LATEST }).catch((e) => {
    kino.log("[kisskh]", "row", key, (e && e.code) || "error");
    return null;
  })));
  return rows.filter(Boolean);
}

/** `home()`: the rows of Kino's Home, none when the person turned them off. */
export async function home(kino, settings) {
  return settings.homeRows ? homeRows(kino) : [];
}

const TABS = [
  { id: "inicio", labelKey: "tabHome" },
  { id: "dramas", labelKey: "tabDramas", type: 1 },
  { id: "peliculas", labelKey: "tabMovies", type: 2 },
  { id: "anime", labelKey: "tabAnime", type: 3 },
];

const foldTab = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** `section({ tab })`: Inicio (the home rows, whatever the Home toggle says) and one tab per type. */
export async function section(kino, settings, tab) {
  const chosen = TABS.find((x) => x.id === foldTab(tab)) || TABS[0];
  const rows = chosen.type
    ? [await row("rowLatest", kino, { type: chosen.type, order: LATEST })].filter(Boolean)
    : await homeRows(kino);
  return { tabs: TABS.map((x) => ({ id: x.id, label: t(x.labelKey, kino) })), tab: chosen.id, rows };
}

const SEARCH_CAP = 100;
const PAGES_PER_CALL = 3;

/** `search(query)`: the site's matches for `q`; `type` ("movie"/"series") is a hint, so its kind goes first and every match stays. */
export async function search(kino, q, type) {
  if (!String(q || "").trim()) return [];
  const items = (await siteSearch(String(q).trim())).map(dress);
  const lean = type === "movie" || type === "series" ? type : null;
  const sorted = lean ? [...items.filter((i) => i.kind === lean), ...items.filter((i) => i.kind !== lean)] : items;
  return sorted.slice(0, SEARCH_CAP);
}

/**
 * `scopedSearch`: the titles of the "Ver más" page `within` (a list:/genre: ref) that contain `q`, reading a few pages per call;
 * `next` is the cursor of the following ones. Null for a ref that is not a page of ours (Kino then filters the page's own titles).
 */
export async function searchWithin(kino, within, q, cursor) {
  const base = parseRef(within);
  if (!base) return null;
  const needle = foldTab(q).trim();
  if (!needle) return { items: [] };
  const n = Number.parseInt(cursor, 10);
  const start = n >= 1 && n <= MAX_PAGE ? n : 1;
  const pages = [];
  for (let p = start; p < start + PAGES_PER_CALL && p <= MAX_PAGE; p++) pages.push(p);
  const got = await Promise.all(pages.map((page) => list({ ...base, page }).catch(() => null)));
  if (got.every((r) => r === null)) return null;
  const read = got.filter(Boolean);
  const hits = read.flatMap((r) => r.items).filter((i) => foldTab(i.title).includes(needle));
  const items = [...new Map(hits.map((i) => [i.id, dress(i)])).values()]; // a title that slid across a page boundary shows once
  const last = read[read.length - 1];
  const more = last.items.length > 0 && start + PAGES_PER_CALL <= MAX_PAGE && (start + PAGES_PER_CALL - 1) * last.pageSize < last.totalCount;
  return more ? { items, next: String(start + PAGES_PER_CALL) } : { items };
}

/** `categories()`: one tile per type, each opening its "Ver más". */
export function categories(kino) {
  return Object.entries(GENRES).map(([key, g]) => ({ id: key, title: t(g.titleKey, kino), ref: "genre:" + key }));
}
