import test from "node:test";
import assert from "node:assert/strict";
import { fakeKino, fixture } from "./helpers/fakeKino.mjs";
import { checkScreenTree } from "../sdk/screen.mjs";
import { screen, screenEvent } from "../src/plugin.js";

const route = (extra) => async (url) => {
  const u = new URL(url);
  if (extra) { const r = extra(u); if (r) return r; }
  if (u.pathname.includes("/Drama/")) return { status: 200, body: fixture("drama.json") };
  if (u.pathname.endsWith("/List")) return { status: 200, body: fixture("list.json") };
  return { status: 200, body: fixture(`curated_${u.pathname.split("/").pop().toLowerCase()}.json`) };
};

const find = (node, pred, out = []) => {
  if (!node || typeof node !== "object") return out;
  if (pred(node)) out.push(node);
  for (const v of Object.values(node)) Array.isArray(v) ? v.forEach((c) => find(c, pred, out)) : find(v, pred, out);
  return out;
};

async function draw(state, lang) {
  const { kino, calls } = fakeKino({ fetch: route(), lang });
  globalThis.kino = kino;
  return { tree: await screen({ state }), calls };
}

test("screen(): logo header, a tab bar, country chips, a hero carousel and title rails", async () => {
  const { tree } = await draw({});
  assert.equal(tree.type, "Scaffold");
  assert.match(tree.appBar.title.children[0].url, /^data:image\/png;base64,/);
  assert.deepEqual(tree.appBar.bottom.tabs.map((x) => x.value), ["inicio", "dramas", "peliculas", "anime"]);
  const pv = find(tree, (n) => n.type === "PageView")[0];
  assert.ok(pv.children.length >= 3 && pv.children.length <= 5, `hero pages: ${pv.children.length}`);
  assert.ok(pv.children.every((c) => c.type === "heroCard" && /^https:\/\//.test(c.image) && c.buttons.length === 1));
  assert.equal(new Set(pv.children.map((c) => c.key)).size, pv.children.length);
  assert.equal(find(tree, (n) => n.type === "Chips")[0].options.length, 7);
  const rails = find(tree, (n) => n.type === "titleRail");
  assert.ok(rails.length >= 8);
  for (const r of rails) for (const i of r.items) assert.match(i.id, /^[A-Za-z0-9._~-]{1,128}$/);
});

test("the tree is valid for the kit in both languages, with nothing dropped", async () => {
  const { tree } = await draw({});
  for (const lang of ["es", "en"]) {
    const r = checkScreenTree(JSON.parse(JSON.stringify(tree)), lang, undefined, { apiVersion: 25 });
    assert.deepEqual(r.dropped, [], r.dropped.join("\n"));
    assert.ok(r.tree);
  }
});

test("a hero button opens its title; a hero is kept without an overview when the detail fails", async () => {
  const { kino } = fakeKino({ fetch: route((u) => (u.pathname.includes("/Drama/") ? { status: 503, body: "" } : null)) });
  globalThis.kino = kino;
  const tree = await screen({ state: {} });
  const hero = find(tree, (n) => n.type === "heroCard")[0];
  assert.ok(hero && hero.text === undefined);
  const go = hero.buttons[0].onPressed.go.title;
  assert.match(go.ref, /^d:\d+$/);
  assert.match(go.id, /^[A-Za-z0-9._~-]{1,128}$/);
});

test("a tab or country change patches the state, flips the skeleton off, and the next draw follows it", async () => {
  const done = [{ hide: "loading" }, { show: "content" }];
  assert.deepEqual(await screenEvent({ name: "tab", value: "anime" }), { state: { tab: "anime" }, ui: done });
  assert.deepEqual(await screenEvent({ name: "country", value: "kr" }), { state: { country: "kr" }, ui: done });
  assert.deepEqual(await screenEvent({ name: "country", value: "zz" }), { state: { country: "all" }, ui: done });
  assert.equal(await screenEvent({ name: "tab", value: "nope" }), null);
  assert.equal(await screenEvent({ name: "other" }), null);
  const { tree, calls } = await draw({ tab: "anime", country: "kr" });
  assert.equal(tree.appBar.bottom.value, "anime");
  assert.equal(find(tree, (n) => n.type === "Chips")[0].value, "kr");
  assert.ok(calls.some((c) => /type=3&sub=0&country=2/.test(c.url)));
});

test("the page carries a hidden skeleton, and the tab bar and chips show it on change", async () => {
  const { tree } = await draw({});
  const loading = find(tree, (n) => n.key === "loading")[0];
  assert.ok(loading && loading.hidden === true, "a hidden loading skeleton is present");
  assert.ok(find(loading, (n) => n.type === "Skeleton").length >= 3, "the skeleton has placeholder blocks");
  assert.ok(find(tree, (n) => n.key === "content")[0], "the content is a hideable node");
  const showLoading = [{ show: "loading" }, { hide: "content" }];
  assert.deepEqual(tree.appBar.bottom.onChanged, { ui: showLoading, event: "tab" });
  assert.deepEqual(find(tree, (n) => n.type === "Chips")[0].onChanged, { ui: showLoading, event: "country" });
});

test("an unreachable site draws an error state, not a crash", async () => {
  const { kino } = fakeKino({ fetch: async () => ({ status: 503, body: "" }) });
  globalThis.kino = kino;
  const tree = await screen({ state: {} });
  assert.equal(find(tree, (n) => n.type === "PageView").length, 0);
  assert.equal(find(tree, (n) => n.type === "emptyState" || n.type === "errorState").length, 1);
});

test("a second draw (a re-tap) is served from the cache: no new request", async () => {
  const { kino, calls } = fakeKino({ fetch: route() });
  globalThis.kino = kino;
  const first = await screen({ state: {} });
  const n = calls.length;
  assert.ok(n > 0);
  const again = await screen({ state: { tab: "inicio", country: "all" } });
  assert.equal(calls.length, n, "cached re-render must not fetch");
  assert.deepEqual(JSON.parse(JSON.stringify(again)), JSON.parse(JSON.stringify(first)));
  await screen({ state: { tab: "dramas" } }); // another tab does fetch its own rails
  assert.ok(calls.length > n);
});

test("hero details are fetched together and capped at five", async () => {
  let live = 0;
  let peak = 0;
  const { kino, calls } = fakeKino({
    fetch: route((u) => {
      if (!u.pathname.includes("/Drama/")) return null;
      return new Promise((res) => {
        live++;
        peak = Math.max(peak, live);
        setTimeout(() => { live--; res({ status: 200, body: fixture("drama.json") }); }, 15);
      });
    }),
  });
  globalThis.kino = kino;
  await screen({ state: {} });
  const details = calls.filter((c) => c.url.includes("/Drama/")).length;
  assert.ok(details >= 3 && details <= 5, `detail fetches: ${details}`);
  assert.equal(peak, details, "all hero details in flight at once");
});

test("the browse header carries a search button that opens the search", async () => {
  const { tree } = await draw({});
  const btn = find(tree, (n) => n.type === "IconButton" && n.icon === "search")[0];
  assert.ok(btn, "a search IconButton in the header");
  assert.equal(btn.onPressed, "open_search");
  assert.ok(btn.labelText && btn.labelTextEn, "the search button is labelled in both languages");
});

test("open_search shows an autofocused field and a prompt; a query fills a result grid; Back closes the search", async () => {
  assert.deepEqual(await screenEvent({ name: "open_search" }), { state: { searching: true, query: "", results: [] } });

  const empty = await draw({ searching: true });
  assert.equal(empty.tree.onBack, "close_search");
  assert.equal(empty.tree.appBar.bottom, undefined, "no tabs while searching");
  const field = find(empty.tree, (n) => n.type === "TextField" && n.key === "q")[0];
  assert.ok(field && field.autofocus === true && field.onSubmitted === "query");
  assert.equal(find(empty.tree, (n) => n.type === "emptyState" && n.key === "prompt").length, 1);

  const { kino, calls } = fakeKino({ fetch: async (url) => (url.includes("/Search?") ? { status: 200, body: fixture("search.json") } : { status: 200, body: fixture("list.json") }) });
  globalThis.kino = kino;
  const r = await screenEvent({ name: "query", value: "hidden" });
  assert.ok(Array.isArray(r.state.results) && r.state.results.length > 0);
  assert.equal(r.state.query, "hidden");
  assert.ok(calls.some((c) => c.url.includes("/Search?")));

  const withResults = await screen({ state: { searching: true, query: "hidden", results: r.state.results } });
  const grid = find(withResults, (n) => n.type === "titleGrid")[0];
  assert.ok(grid && grid.items.length === r.state.results.length);
  for (const it of grid.items) assert.match(it.id, /^[A-Za-z0-9._~-]{1,128}$/);
  for (const lang of ["es", "en"]) {
    const chk = checkScreenTree(JSON.parse(JSON.stringify(withResults)), lang, undefined, { apiVersion: 25 });
    assert.deepEqual(chk.dropped, [], chk.dropped.join("\n"));
  }

  assert.deepEqual(await screenEvent({ name: "close_search" }), { state: { searching: false, query: "", results: [] } });
});

test("a blank query clears the results without hitting the site", async () => {
  const { kino, calls } = fakeKino({ fetch: async () => ({ status: 200, body: fixture("search.json") }) });
  globalThis.kino = kino;
  assert.deepEqual(await screenEvent({ name: "query", value: "   " }), { state: { query: "", results: [] } });
  assert.equal(calls.length, 0, "a blank query does not hit the site");
});

test("a failed rail drops only itself and is not cached", async () => {
  let broken = true;
  const { kino } = fakeKino({ fetch: route((u) => (broken && u.pathname.endsWith("/TopRating") ? { status: 503, body: "" } : null)) });
  globalThis.kino = kino;
  const a = find(await screen({ state: {} }), (n) => n.type === "titleRail");
  assert.ok(a.length >= 5 && !a.some((r) => r.key === "rail-toprating"));
  broken = false;
  const b = find(await screen({ state: {} }), (n) => n.type === "titleRail");
  assert.ok(b.some((r) => r.key === "rail-toprating"), "the failure was not cached");
});
