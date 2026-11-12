import test from "node:test";
import assert from "node:assert/strict";
import { fakeKino, fixture } from "./helpers/fakeKino.mjs";
import { dress, home, browse, section, categories } from "../src/catalog.js";

const serve = () => fakeKino({ fetch: async () => ({ status: 200, body: fixture("list.json") }) });
const params = (url) => Object.fromEntries(new URL(url).searchParams);

test("dress maps a list item to a tile, movie when it has a single episode", () => {
  const base = { id: 7, title: "T", thumbnail: "https://x/p.jpg", label: "", episodesCount: 1 };
  assert.deepEqual(dress(base), { id: "7", ref: "d:7", title: "T", poster: "https://x/p.jpg", kind: "movie", episodesCount: 1 });
  assert.equal(dress({ ...base, episodesCount: 16 }).kind, "series");
  assert.equal(dress({ ...base, episodesCount: 0 }).kind, "movie");
});

test("section tabs query their type", async () => {
  for (const [tab, type] of [["Dramas", "1"], ["Películas", "2"], ["Anime", "3"]]) {
    const { kino, calls } = serve();
    globalThis.kino = kino;
    const s = await section(kino, { homeRows: true }, tab);
    assert.equal(params(calls[0].url).type, type);
    assert.ok(s.rows.length && s.rows[0].items.length);
    assert.equal(s.tabs.length, 4);
  }
  const { kino } = serve();
  globalThis.kino = kino;
  assert.equal((await section(kino, {}, "nonsense")).tab, "inicio");
});

test("browse pages by cursor with the ref's list params", async () => {
  const { kino, calls } = serve();
  globalThis.kino = kino;
  const r = await browse(kino, "list:1:0:0:1", "2");
  const p = params(calls[0].url);
  assert.deepEqual([p.page, p.type, p.country, p.status, p.order], ["2", "1", "0", "0", "1"]);
  assert.ok(r.items.length && r.items[0].ref.startsWith("d:"));
  assert.equal(r.cursor, "3");
  const last = await browse(kino, "list:1:0:0:1", "1105");
  assert.equal(last.cursor, undefined);
  await assert.rejects(() => browse(kino, "bogus", null));
});

test("home is gated by settings.homeRows", async () => {
  const { kino, calls } = serve();
  globalThis.kino = kino;
  assert.deepEqual(await home(kino, { homeRows: false }), []);
  assert.equal(calls.length, 0);
  const rows = await home(kino, { homeRows: true });
  assert.ok(rows.length >= 2);
  assert.ok(rows.every((r) => r.title && r.items.length && /^(list|cur):/.test(r.ref)));
});

test("categories refs are browsable", async () => {
  const { kino, calls } = serve();
  globalThis.kino = kino;
  const tiles = categories(kino);
  assert.deepEqual(tiles.map((t) => t.id), ["pais.kr", "pais.cn", "pais.jp", "pais.th", "pais.tw", "pais.ph", "pais.west", "tipo.dramas", "tipo.movies", "tipo.anime"]);
  assert.equal(tiles[0].ref, "list:0:2:0:1");
  assert.equal(tiles[9].ref, "list:3:0:0:1");
  for (const tile of tiles) {
    assert.ok(tile.title && /^list:\d+:\d+:0:1$/.test(tile.ref));
    assert.match(tile.id, /^[A-Za-z0-9._~-]{1,128}$/);
    calls.length = 0;
    assert.ok((await browse(kino, tile.ref, null)).items.length);
    assert.equal(calls.length, 1);
  }
});

test("a type tab whose row fails still answers, with no rows", async () => {
  const { kino } = fakeKino({ fetch: async () => ({ status: 500, body: "{}" }) });
  globalThis.kino = kino;
  const s = await section(kino, {}, "Dramas");
  assert.deepEqual(s.rows, []);
  assert.equal(s.tab, "dramas");
});

const ID = /^[A-Za-z0-9._~-]{1,128}$/; // the host's output.itemIdPattern: no colon

test("every id the host validates is colon-free, and refs keep the colon form", async () => {
  const { kino } = serve();
  globalThis.kino = kino;
  const checkRows = (rows) => {
    assert.ok(rows.length);
    const ids = rows.map((r) => r.id);
    assert.equal(new Set(ids).size, ids.length, "row ids are unique");
    for (const r of rows) {
      assert.match(r.id, ID);
      assert.match(r.ref, /^(list|cur):/);
      for (const i of r.items) { assert.match(i.id, ID); assert.match(i.ref, /^d:\d+$/); }
    }
  };
  checkRows(await home(kino, { homeRows: true }));
  for (const tab of ["Inicio", "Dramas", "Películas", "Anime"]) {
    const s = await section(kino, { homeRows: true }, tab);
    for (const t of s.tabs) assert.match(t.id, ID);
    checkRows(s.rows);
  }
  const cats = categories(kino);
  assert.equal(new Set(cats.map((c) => c.id)).size, cats.length);
  for (const c of cats) { assert.match(c.id, ID); assert.match(c.ref, /^list:/); }
  for (const i of (await browse(kino, "list:1:0:0:1", "1")).items) assert.match(i.id, ID);
});

test("Inicio carries the country rows, with colon-free ids", async () => {
  const { kino } = serve();
  globalThis.kino = kino;
  const rows = await home(kino, { homeRows: true });
  for (const id of ["pais.th.0", "pais.jp.0", "pais.tw.0"]) assert.ok(rows.some((r) => r.id === id), id);
  assert.equal(rows.find((r) => r.id === "pais.th.0").ref, "list:0:5:0:1");
});
