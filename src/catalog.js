// The browsable side: KissKH's catalogue as Kino tiles, rows, "Ver más" pages, a section and category tiles.
//
// Refs (opaque, shared with details/episodes/resolve):
//   d:<dramaId>                                   a title (the tile's ref)
//   list:<type>:<country>:<status>:<order>        a browse page; type 0 all, 1 series, 2 movie, 3 anime, 4 Hollywood
//   genre:<key>                                   a category tile's page, the same list params under a name
//   e:<dramaId>:<episodeId>:<number>              a series episode (detail.js makes it, resolve reads it)
//   cur:<name>                                    a curated shelf (one page, no cursor): see CURATED
//   m:<dramaId>                                   a movie's play ref (resolve reads it)

import { list, search as siteSearch, lastUpdate, topRating, mostView, animate, mostSearch, upcoming } from "./api.js";
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
    id: String(item.id), // the host's itemIdPattern (^[A-Za-z0-9._~-]{1,128}$) has no colon: the "d:" form lives in ref only
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
  const cur = /^cur:([a-z]+)$/.exec(String(ref || ""));
  if (cur && Object.prototype.hasOwnProperty.call(CURATED, cur[1])) {
    return Number.parseInt(cursor, 10) > 1 ? { items: [] } : { items: (await CURATED[cur[1]].load()).map(dress) };
  }
  const q = parseRef(ref);
  if (!q) throw kino.error("not_found", "unknown browse ref");
  const n = Number.parseInt(cursor, 10);
  const page = n >= 1 && n <= MAX_PAGE ? n : 1;
  const r = await list({ ...q, page });
  const items = r.items.map(dress);
  return items.length && page < MAX_PAGE && page * r.pageSize < r.totalCount ? { items, cursor: String(page + 1) } : { items };
}

const NEWEST = 3; // the site's "recently added" order
const UPDATED = 2; // the site's "recently updated" order
const COUNTRY_CN = 1;
const COUNTRY_KR = 2;

/** Curated shelves (colon-free names, they are also the row ids): the loader and the shelf's title key. */
const CURATED = {
  lastupdate: { load: lastUpdate, titleKey: "rowLastUpdate" },
  toprating: { load: topRating, titleKey: "rowTopRating" },
  mostview: { load: () => mostView(COUNTRY_CN), titleKey: "rowMostViewCn" },
  anime: { load: animate, titleKey: "rowAnime" },
  mostsearch: { load: mostSearch, titleKey: "rowMostSearch" },
  upcoming: { load: upcoming, titleKey: "rowUpcoming" },
};

/** A list-backed row: id "<slug>.<type>" (no colon; the colon form stays in `ref`). */
const listRow = (slug, titleKey, q) => ({ id: `${slug}.${q.type}`, titleKey, q: { status: 0, ...q } });
const curatedRow = (name) => ({ id: name, titleKey: CURATED[name].titleKey, curated: name });

async function build(def, kino) {
  const items = def.curated
    ? (await CURATED[def.curated].load()).map(dress)
    : (await list({ ...def.q, page: 1 })).items.map(dress);
  const capped = items.slice(0, ROW_CAP);
  if (!capped.length) return null;
  const ref = def.curated ? "cur:" + def.curated : listRef(def.q.type, def.q.country, def.q.status, def.q.order);
  return { id: def.id, title: t(def.titleKey, kino), items: capped, ref };
}

/** The rows of [defs] fetched side by side; one that fails or comes back empty is left out. */
async function rowsOf(kino, defs) {
  const rows = await Promise.all(defs.map((d) => build(d, kino).catch((e) => {
    kino.log("[kisskh]", "row", d.id, (e && e.code) || "error");
    return null;
  })));
  return rows.filter(Boolean);
}

const HOME_ROWS = [
  listRow("novedades", "rowLatest", { type: 0, order: LATEST }),
  curatedRow("lastupdate"),
  listRow("mostview.kr", "rowMostViewKr", { type: 0, country: COUNTRY_KR, order: LATEST }),
  listRow("mostview.cn", "rowMostViewCn", { type: 0, country: COUNTRY_CN, order: LATEST }),
  curatedRow("toprating"),
  curatedRow("mostsearch"),
  curatedRow("anime"),
  curatedRow("upcoming"),
  listRow("pais.th", "rowThai", { type: 0, country: 5, order: LATEST }),
  listRow("pais.jp", "rowJapanese", { type: 0, country: 3, order: LATEST }),
  listRow("pais.tw", "rowTaiwanese", { type: 0, country: 7, order: LATEST }),
];

/** A type tab's rows: its newest, its latest updates, Korea and China favourites, then the shelves that fit it. */
const typeRows = (type, extra) => [
  listRow("novedades", "rowLatest", { type, order: LATEST }),
  listRow("lastupdate", "rowLastUpdate", { type, order: UPDATED }),
  listRow("mostview.kr", "rowMostViewKr", { type, country: COUNTRY_KR, order: LATEST }),
  listRow("mostview.cn", "rowMostViewCn", { type, country: COUNTRY_CN, order: LATEST }),
  ...extra,
];

const TAB_ROWS = {
  1: typeRows(1, [curatedRow("toprating"), listRow("recent", "rowNewest", { type: 1, order: NEWEST })]),
  2: typeRows(2, [curatedRow("toprating"), listRow("hollywood", "rowHollywood", { type: 4, order: LATEST })]),
  3: typeRows(3, [curatedRow("anime"), listRow("recent", "rowNewest", { type: 3, order: NEWEST })]),
};

const homeRows = (kino) => rowsOf(kino, HOME_ROWS);

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
  const rows = chosen.type ? await rowsOf(kino, TAB_ROWS[chosen.type]) : await homeRows(kino);
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

/** Category tiles: by country (list country filter) then by type. Ids are colon-free slugs; the list: form lives in `ref`. */
const COUNTRIES = [
  { slug: "kr", country: COUNTRY_KR, titleKey: "catKorean" },
  { slug: "cn", country: COUNTRY_CN, titleKey: "catChinese" },
  { slug: "jp", country: 3, titleKey: "catJapanese" },
  { slug: "th", country: 5, titleKey: "catThai" },
  { slug: "tw", country: 7, titleKey: "catTaiwanese" },
  { slug: "ph", country: 8, titleKey: "catFilipino" },
  { slug: "west", country: 6, titleKey: "catWestern" },
];
const TYPES = [
  { slug: "dramas", type: 1, titleKey: "catDramas" },
  { slug: "movies", type: 2, titleKey: "catMovies" },
  { slug: "anime", type: 3, titleKey: "catAnime" },
];

/** `categories()`: one tile per country and per type, each opening its "Ver más". */
export function categories(kino) {
  return [
    ...COUNTRIES.map((c) => ({ id: `pais.${c.slug}`, title: t(c.titleKey, kino), ref: listRef(0, c.country) })),
    ...TYPES.map((x) => ({ id: `tipo.${x.slug}`, title: t(x.titleKey, kino), ref: listRef(x.type) })),
  ];
}
