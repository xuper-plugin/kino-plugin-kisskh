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

// A tab or country change shows a skeleton at once (the fetch takes a moment) and hides the old content; the event's answer
// flips them back when the fresh rails are ready. Kino keeps these ui ops in state.ui, so the answer must reset them.
const UI_LOAD = [{ show: "loading" }, { hide: "content" }];
const UI_DONE = [{ hide: "loading" }, { show: "content" }];
const TAB_CHANGE = { ui: UI_LOAD, event: "tab" };
const COUNTRY_CHANGE = { ui: UI_LOAD, event: "country" };

const plain = (o) => (o && typeof o === "object" && !Array.isArray(o) ? o : {});

/** One rail's placeholder: a short title line over a row of flex-sized cards (widths always on Kino's size scale). */
const railSkeleton = (n) => ({
  type: "Column", key: "sk-row-" + n, gap: 8, children: [
    { type: "Skeleton", key: "sk-title-" + n, shape: "line", width: 120 },
    { type: "Row", key: "sk-cards-" + n, gap: 12, children: [0, 1, 2].map((i) => ({ type: "Skeleton", key: `sk-card-${n}-${i}`, shape: "card", flex: 1 })) },
  ],
});

/** A hidden placeholder of the page (an edge-to-edge hero block over two padded rows) revealed while a tab or country reloads. */
const skeleton = () => ({
  type: "Column", key: "loading", hidden: true, gap: 16, children: [
    { type: "Skeleton", key: "sk-hero", shape: "block", height: { compact: 200, expanded: 320 } },
    { type: "Column", key: "sk-below", padding: PAGE_PADDING, gap: 16, children: [railSkeleton(0), railSkeleton(1)] },
  ],
});

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
    type: "TabBar", key: "tabs", divider: false, value: tab, onChanged: TAB_CHANGE,
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

  // The hero is full-bleed (no viewportFraction peek, no end pad) and sits outside the body padding, so it reaches both edges.
  const hero = picks.length
    ? { type: "PageView", key: "heroes", autoPlayMs: 6000, padEnds: false, children: picks.map(heroPage) }
    : null;

  // Everything under the hero keeps a side margin.
  const below = [{
    type: "Chips", key: "country", value: country, onChanged: COUNTRY_CHANGE,
    options: [
      { value: "all", ...both("allCountries", "label") },
      ...COUNTRIES.filter((c) => c.slug !== "west").map((c) => ({ value: c.slug, ...both(c.titleKey, "label") })),
    ],
  }];
  if (rows.length) below.push(...rows.map(rail));
  else {
    below.push(failed
      ? { type: "errorState", key: "failed", icon: "refresh", ...both("screenFailTitle", "title"), ...both("screenFailText") }
      : { type: "emptyState", key: "nothing", icon: "movie", ...both("screenFailTitle", "title") });
  }

  const content = {
    type: "Column", key: "content", gap: 16, children: [
      ...(hero ? [hero] : []),
      { type: "Column", key: "below", padding: PAGE_PADDING, gap: 16, children: below },
    ],
  };

  return {
    type: "Scaffold", key: "app", appBar: browseBar(tab),
    body: { type: "SingleChildScrollView", key: "page-" + tab, children: [
      { type: "Column", key: "body", gap: 16, children: [skeleton(), content] },
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
  // tab/country: the skeleton the tap showed is flipped off and the fresh content on (UI_LOAD did the opposite on the tap).
  if (name === "tab" && tabIds.includes(value)) return { state: { tab: value }, ui: UI_DONE };
  if (name === "country") return { state: { country: countrySlugs.includes(value) ? value : "all" }, ui: UI_DONE };
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
