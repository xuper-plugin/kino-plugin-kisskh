// KissKH's own canvas (apiVersion 14, capability "screen"): a header with the logo, a carousel of featured titles, a tab bar,
// country chips and Kino's title rails. State: { tab, country }. A rail's card opens the title by itself (Kino's own card);
// a hero's button opens it with `go`. Data comes from catalog.js (rows) and api.js (overviews); nothing is fetched here.
import { t } from "./i18n.js";
import { TABS, COUNTRIES, tabRows, heroPicks } from "./catalog.js";
import { LOGO_DATA } from "./logo.js";

const tabIds = TABS.map((x) => x.id);
const countrySlugs = COUNTRIES.filter((c) => c.slug !== "west").map((c) => c.slug);
const PAGE_PADDING = { compact: 12, expanded: 24 };
const HERO_COUNT = 5;

const plain = (o) => (o && typeof o === "object" && !Array.isArray(o) ? o : {});

/** Both languages of a catalogue text: `{ text, textEn }` (or [prop]), from the i18n table. */
const both = (key, prop = "text") => {
  const es = t(key, { lang: "es" });
  const en = t(key, { lang: "en" });
  return { [prop]: es, [prop + "En"]: en };
};

const header = () => ({
  type: "AppBar", key: "bar", mergeWithKinoBar: true, dense: true,
  title: { type: "Row", key: "brand", gap: 8, crossAxisAlignment: "center", children: [
    { type: "Image", key: "logo", url: LOGO_DATA, aspect: "1:1", fit: "contain", h: 32, ...both("logoAlt", "alt") },
    { type: "Text", key: "wordmark", text: "KissKH", style: "h3" },
  ] },
  leading: { type: "IconButton", key: "barClose", icon: "close", ...both("close", "labelText"), onPressed: { close: true } },
  bottom: {
    type: "TabBar", key: "tabs", divider: false, value: "", onChanged: "tab",
    tabs: TABS.map((x) => ({ value: x.id, ...both(x.labelKey, "label") })),
  },
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

/** The whole canvas for [state] ({ tab, country }): a Scaffold with the bar (logo, tabs) over a scrolling body. */
export async function buildScreen(kino, state) {
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

  const appBar = header();
  appBar.bottom.value = tab;

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
    type: "Scaffold", key: "app", appBar,
    body: { type: "SingleChildScrollView", key: "page-" + tab, children: [
      { type: "Column", key: "body", gap: 16, padding: PAGE_PADDING, children },
    ] },
  };
}

/** `screenEvent`: the tab bar and the chips patch Kino's state for the next draw; nothing else is ours. */
export function handleEvent(event) {
  const { name, value } = plain(event);
  if (name === "tab" && tabIds.includes(value)) return { state: { tab: value } };
  if (name === "country") return { state: { country: countrySlugs.includes(value) ? value : "all" } };
  return null;
}
