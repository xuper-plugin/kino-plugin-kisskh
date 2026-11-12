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

test("a tab or country change patches the state and the next draw follows it", async () => {
  assert.deepEqual(await screenEvent({ name: "tab", value: "anime" }), { state: { tab: "anime" } });
  assert.deepEqual(await screenEvent({ name: "country", value: "kr" }), { state: { country: "kr" } });
  assert.deepEqual(await screenEvent({ name: "country", value: "zz" }), { state: { country: "all" } });
  assert.equal(await screenEvent({ name: "tab", value: "nope" }), null);
  assert.equal(await screenEvent({ name: "other" }), null);
  const { tree, calls } = await draw({ tab: "anime", country: "kr" });
  assert.equal(tree.appBar.bottom.value, "anime");
  assert.equal(find(tree, (n) => n.type === "Chips")[0].value, "kr");
  assert.ok(calls.some((c) => /type=3&sub=0&country=2/.test(c.url)));
});

test("an unreachable site draws an error state, not a crash", async () => {
  const { kino } = fakeKino({ fetch: async () => ({ status: 503, body: "" }) });
  globalThis.kino = kino;
  const tree = await screen({ state: {} });
  assert.equal(find(tree, (n) => n.type === "PageView").length, 0);
  assert.equal(find(tree, (n) => n.type === "emptyState" || n.type === "errorState").length, 1);
});
