import test from "node:test";
import assert from "node:assert/strict";
import { fakeKino, fixture } from "./helpers/fakeKino.mjs";
import { list, search, drama } from "../src/api.js";
import { getJson, UA } from "../src/util/http.js";

const serve = (name) => fakeKino({ fetch: async () => ({ status: 200, body: fixture(name) }) });

const isItem = (i) =>
  Number.isInteger(i.id) && typeof i.title === "string" && typeof i.thumbnail === "string" &&
  Number.isInteger(i.episodesCount) && typeof i.label === "string";

test("list parses the catalogue page into { page, pageSize, totalCount, items }", async () => {
  const { kino, calls } = serve("list.json");
  globalThis.kino = kino;
  const r = await list({ page: 1, pageSize: 12 });
  assert.equal(r.page, 1);
  assert.equal(r.pageSize, 12);
  assert.equal(r.totalCount, 13243);
  assert.equal(r.items.length, 12);
  assert.ok(r.items.every(isItem));
  assert.equal(r.items[0].id, 9987);
  assert.equal(calls[0].url, "https://kisskh.do/api/DramaList/List?page=1&type=0&sub=0&country=0&status=0&order=1&pageSize=12");
  assert.equal(calls[0].opts.headers["User-Agent"], UA);
  assert.equal(calls[0].opts.headers.Referer, "https://kisskh.do/");
});

test("search parses the flat result array into Item[]", async () => {
  const { kino, calls } = serve("search.json");
  globalThis.kino = kino;
  const items = await search("hidden heir");
  assert.equal(items.length, 5);
  assert.ok(items.every(isItem));
  assert.equal(items[0].title, "The Hidden Heir Ye Chen");
  assert.equal(calls[0].url, "https://kisskh.do/api/DramaList/Search?q=hidden%20heir&type=0");
});

test("drama parses the detail, keeping the episodes in the site's order", async () => {
  const { kino, calls } = serve("drama.json");
  globalThis.kino = kino;
  const d = await drama(8316);
  assert.equal(d.id, 8316);
  assert.equal(d.title, "The First Frost");
  assert.equal(d.type, "TVSeries");
  assert.equal(d.country, "China");
  assert.equal(d.status, "Completed");
  assert.equal(d.releaseDate, "2025-02-18T01:31:08");
  assert.equal(d.episodesCount, 32);
  assert.equal(d.episodes.length, 32);
  assert.deepEqual(d.episodes[0], { id: 177129, number: 32, sub: 5 });
  assert.equal(calls[0].url, "https://kisskh.do/api/DramaList/Drama/8316?isq=false");
});

test("an HTML body (a Cloudflare challenge) throws unavailable", async () => {
  const { kino } = fakeKino({ fetch: async () => ({ status: 200, body: fixture("challenge.html") }) });
  globalThis.kino = kino;
  await assert.rejects(getJson("https://kisskh.do/api/DramaList/List"), (e) => e.code === "unavailable");
  await assert.rejects(search("x"), (e) => e.code === "unavailable");
});
