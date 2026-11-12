// KissKH's own canvas (apiVersion 14, capability "screen"): a header with the logo, a carousel of featured titles, a tab bar,
// country chips and Kino's title rails, plus a search button that opens a search field over a results grid. State:
// { tab, country, searching, query, results }. A rail's or result's card opens the title by itself (Kino's own card);
// a hero's button opens it with `go`. Data comes from catalog.js (rows, search) and api.js (overviews).
import { t } from "./i18n.js";
import { TABS, COUNTRIES, tabRows, heroPicks, search } from "./catalog.js";
import { LOGO_DATA } from "./logo.js";

const tabIds = TABS.map((x) => x.id);
const countrySlugs = COUNTRIES.filter((c) => c.slug !== "west").map((c) => c.slug);
const PAGE_PADDING = { compact: 12, expanded: 24 };
const HERO_COUNT = 5;
const SEARCH_COLUMNS = { compact: 3, expanded: 6 };
const SEARCH_MAX_CHARS = 100;

const plain = (o) => (o && typeof o === "object" && !Array.isArray(o) ? o : {});

/** Both languages of a catalogue text: `{ text, textEn }` (or [prop]), from the i18n table. */
const both = (key, prop = "text") => {
  const es = t(key, { lang: "es" });
  const en = t(key, { lang: "en" });
  return { [prop]: es, [prop + "En"]: en };
};

/** The logo and wordmark, the bar's title in every state. */
const brand = () => ({
  type: "Row", key: "brand", gap: 8, crossAxisAlignment: "center", children: [
    { type: "Image", key: "logo", url: LOGO_DATA, aspect: "1:1", fit: "contain", h: 32, ...both("logoAlt", "alt") },
    { type: "Text", key: "wordmark", text: "KissKH", style: "h3" },
  ],
});

/** The browsing header: logo, a Close, a Search button and the type tabs. */
const browseBar = (tab) => ({
  type: "AppBar", key: "bar", mergeWithKinoBar: true, dense: true,
  title: brand(),
  leading: { type: "IconButton", key: "barClose", icon: "close", ...both("close", "labelText"), onPressed: { close: true } },
  actions: [{ type: "IconButton", key: "openSearch", icon: "search", ...both("search", "labelText"), onPressed: "open_search" }],
  bottom: {
    type: "TabBar", key: "tabs", divider: false, value: tab, onChanged: "tab",
    tabs: TABS.map((x) => ({ value: x.id, ...both(x.labelKey, "label") })),
  },
});

/** The search header: logo and a Back that leaves the search (Back closes the search before the screen). */
const searchBar = () => ({
  type: "AppBar", key: "bar", mergeWithKinoBar: true, dense: true,
  title: brand(),
  leading: { type: "IconButton", key: "barBack", icon: "arrow_back", ...both("searchClose", "labelText"), onPressed: "close_search" },
  actions: [],
});

/** One carousel page: the title's wide picture, name, overview and a "Ver" button that opens it. */
function heroPage({ item, text }, i) {
  const target = { ref: item.ref, kind: item.kind, id: item.id, title: item.title };
  return {
    type: "heroCard", key: "hero-" + item.id, title: item.title, titleEn: item.title, image: item.poster,
    ...(text ? { text, textEn: text } : {}), h: { compact: 240, expanded: 320 },
    buttons: [{ type: "ElevatedButton", key: "hero-go-" + i, icon: "play", ...both("watch", "labelText"), onPressed: { go: { title: target } } }],
  };
}

const rail = (row) => ({
  type: "titleRail", key: "rail-" + row.id, title: row.title, titleEn: row.title, size: "medium",
  items: row.items, ref: row.ref,
});

/** The browse canvas for [state] ({ tab, country }): the bar (logo, search, tabs) over a hero carousel, chips and rails. */
async function browseView(kino, state) {
  const tab = tabIds.includes(state.tab) ? state.tab : "inicio";
  const country = countrySlugs.includes(state.country) ? state.country : "all";

  let rows = [];
  let failed = false;
  try {
    rows = await tabRows(kino, tab, country);
  } catch (e) {
    kino.log("[kisskh]", "screen rows", (e && e.code) || "error");
    failed = true;
  }
  const picks = rows.length ? await heroPicks(kino, rows, HERO_COUNT).catch(() => []) : [];

  const children = [];
  if (picks.length) {
    children.push({
      type: "PageView", key: "heroes", autoPlayMs: 6000, viewportFraction: { compact: 0.94, expanded: 0.7 }, padEnds: true,
      children: picks.map(heroPage),
    });
  }
  children.push({
    type: "Chips", key: "country", value: country, onChanged: "country",
    options: [
      { value: "all", ...both("allCountries", "label") },
      ...COUNTRIES.filter((c) => c.slug !== "west").map((c) => ({ value: c.slug, ...both(c.titleKey, "label") })),
    ],
  });
  if (rows.length) children.push(...rows.map(rail));
  else {
    children.push(failed
      ? { type: "errorState", key: "failed", icon: "refresh", ...both("screenFailTitle", "title"), ...both("screenFailText") }
      : { type: "emptyState", key: "nothing", icon: "movie", ...both("screenFailTitle", "title") });
  }

  return {
    type: "Scaffold", key: "app", appBar: browseBar(tab),
    body: { type: "SingleChildScrollView", key: "page-" + tab, children: [
      { type: "Column", key: "body", gap: 16, padding: PAGE_PADDING, children },
    ] },
  };
}

/** The search canvas: an autofocused search field over the result grid (or a prompt / no-results note). */
function searchView(state) {
  const query = typeof state.query === "string" ? state.query : "";
  const results = Array.isArray(state.results) ? state.results : [];
  const children = [
    {
      type: "TextField", key: "q", kind: "search", value: query, autofocus: true, maxLength: SEARCH_MAX_CHARS,
      ...both("search", "labelText"), ...both("searchHint", "hintText"), onSubmitted: "query",
    },
  ];
  if (results.length) children.push({ type: "titleGrid", key: "results", columns: SEARCH_COLUMNS, items: results });
  else children.push(query
    ? { type: "emptyState", key: "none", icon: "search", ...both("searchNone", "title") }
    : { type: "emptyState", key: "prompt", icon: "search", ...both("searchPrompt", "title") });

  return {
    type: "Scaffold", key: "app", onBack: "close_search", appBar: searchBar(),
    body: { type: "SingleChildScrollView", key: "search", children: [
      { type: "Column", key: "searchBody", gap: 16, padding: PAGE_PADDING, children },
    ] },
  };
}

/** The whole canvas for [state]: the search view while `searching`, else the browse view. */
export async function buildScreen(kino, state) {
  return state.searching === true ? searchView(state) : browseView(kino, state);
}

/**
 * `screenEvent`: the tab bar and the chips patch Kino's state; the search button opens the field, Back closes it,
 * and a submitted query fetches the matches. A patch merges, so each case sets only what changes.
 */
export async function handleEvent(kino, event) {
  const { name, value } = plain(event);
  if (name === "tab" && tabIds.includes(value)) return { state: { tab: value } };
  if (name === "country") return { state: { country: countrySlugs.includes(value) ? value : "all" } };
  if (name === "open_search") return { state: { searching: true, query: "", results: [] } };
  if (name === "close_search") return { state: { searching: false, query: "", results: [] } };
  if (name === "query") {
    const q = String(value == null ? "" : value).trim();
    if (!q) return { state: { query: "", results: [] } };
    let results = [];
    try {
      results = await search(kino, q);
    } catch (e) {
      kino.log("[kisskh]", "screen search", (e && e.code) || "error");
    }
    return { state: { query: q, results } };
  }
  return null;
}
