import test from "node:test";
import assert from "node:assert/strict";
import { fakeKino, fixture } from "./helpers/fakeKino.mjs";
import { home, browse, section } from "../src/catalog.js";

const ID = /^[A-Za-z0-9._~-]{1,128}$/;
const REF = /^(list:\d{1,2}:\d{1,3}:\d{1,3}:\d{1,2}|cur:[a-z]+)$/;

/** Lists answer list.json, each curated endpoint its fixture; `override(name)` can replace one answer. */
const route = (override) => async (url) => {
  const u = new URL(url);
  if (u.pathname.endsWith("/List")) return { status: 200, body: fixture("list.json") };
  const name = u.pathname.split("/").pop().toLowerCase();
  return (override && override(name)) || { status: 200, body: fixture(`curated_${name}.json`) };
};

function checkRows(rows) {
  assert.equal(new Set(rows.map((r) => r.id)).size, rows.length, "row ids are unique");
  for (const r of rows) {
    assert.match(r.id, ID);
    assert.match(r.ref, REF);
    assert.ok(r.title && r.items.length && r.items.length <= 24);
    for (const i of r.items) assert.match(i.id, ID);
  }
}

test("home shows the site's shelves with colon-free ids and valid refs", async () => {
  const { kino } = fakeKino({ fetch: route() });
  globalThis.kino = kino;
  const rows = await home(kino, { homeRows: true });
  assert.deepEqual(rows.map((r) => r.id), ["novedades.0", "ultimos.1", "ultimos.3", "ultimos.2", "lastupdate", "mostview.kr.0", "mostview.cn.0", "toprating", "mostsearch", "anime", "upcoming", "pais.th.0", "pais.jp.0", "pais.tw.0"]);
  checkRows(rows);
});

test("every type tab has several rows", async () => {
  for (const tab of ["Dramas", "Películas", "Anime"]) {
    const { kino } = fakeKino({ fetch: route() });
    globalThis.kino = kino;
    const s = await section(kino, { homeRows: true }, tab);
    assert.ok(s.rows.length >= 5, `${tab}: ${s.rows.length} rows`);
    checkRows(s.rows);
  }
  const { kino } = fakeKino({ fetch: route(), lang: "en-US" });
  globalThis.kino = kino;
  const titles = (await section(kino, {}, "anime")).rows.map((r) => r.title);
  assert.ok(titles.includes("Latest updates") && titles.includes("Most viewed (Korea)"));
});

test("a failed curated endpoint drops only its row", async () => {
  const { kino } = fakeKino({
    fetch: route((n) => (n === "toprating" ? { status: 503, body: "" } : n === "animate" ? { status: 200, body: "<html>" } : null)),
  });
  globalThis.kino = kino;
  const rows = await home(kino, { homeRows: true });
  assert.equal(rows.length, 12);
  assert.ok(!rows.some((r) => r.id === "toprating" || r.id === "anime"));
  const dramas = await section(kino, {}, "dramas");
  assert.ok(dramas.rows.length >= 4 && !dramas.rows.some((r) => r.id === "toprating"));
});

test("Inicio has a featured-title hero (title, image, overview); other tabs and an empty catalogue have none", async () => {
  const { kino } = fakeKino({
    fetch: async (url) => (new URL(url).pathname.includes("/Drama/") ? { status: 200, body: fixture("drama.json") } : route()(url)),
  });
  globalThis.kino = kino;
  const s = await section(kino, {}, "inicio");
  assert.ok(s.hero && s.hero.title && /^https:\/\//.test(s.hero.image));
  assert.ok(!s.hero.text || s.hero.text.length <= 300);
  assert.equal((await section(kino, {}, "dramas")).hero, undefined);

  const bare = fakeKino({ fetch: async () => ({ status: 200, body: "[]" }) });
  globalThis.kino = bare.kino;
  assert.equal((await section(bare.kino, {}, "inicio")).hero, undefined);
});

test("the hero keeps title and image when the detail fetch fails", async () => {
  const { kino } = fakeKino({
    fetch: async (url) => (new URL(url).pathname.includes("/Drama/") ? { status: 503, body: "" } : route()(url)),
  });
  globalThis.kino = kino;
  const s = await section(kino, {}, "inicio");
  assert.ok(s.hero && s.hero.title && s.hero.image && !s.hero.text);
});

test("a curated shelf opens as a one-page Ver más", async () => {
  const { kino } = fakeKino({ fetch: route() });
  globalThis.kino = kino;
  const r = await browse(kino, "cur:toprating", null);
  assert.ok(r.items.length && r.cursor === undefined);
  assert.deepEqual((await browse(kino, "cur:toprating", "2")).items, []);
  await assert.rejects(() => browse(kino, "cur:nope", null));
});
