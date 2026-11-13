import test from "node:test";
import assert from "node:assert/strict";
import { fakeKino, fixture } from "./helpers/fakeKino.mjs";
import { details } from "../src/detail.js";
import { heroPicks } from "../src/catalog.js";

const drama = JSON.parse(fixture("drama.json"));
const serve = (tmdb, body = fixture("drama.json")) => {
  const { kino } = fakeKino({ fetch: async () => ({ status: 200, body }), extra: { tmdb } });
  globalThis.kino = kino;
  return kino;
};
const year = +drama.releaseDate.slice(0, 4);
const hit = { id: 4242, name: drama.title, first_air_date: `${year}-03-01` };
const rows = [{ items: [{ id: "8316", ref: "d:8316", title: drama.title, kind: "series", poster: "https://media.themoviedb.org/t/p/w1000/x.jpg" }] }];

test("details attaches ids.tmdb from the matched search result", async () => {
  const seen = [];
  const kino = serve(async (path, params) => { seen.push([path, params]); return { results: [{ id: 1, name: "Other" }, hit] }; });
  const info = await details(kino, "d:8316");
  assert.deepEqual(info.ids, { tmdb: 4242 });
  assert.equal(info.title, drama.title);
  assert.equal(seen[0][0], "/search/tv");
  assert.equal(seen[0][1].include_adult, false);
});

test("a cached match skips the kino.tmdb search the second time", async () => {
  let searches = 0;
  const kino = serve(async () => { searches++; return { results: [hit] }; });
  assert.deepEqual((await details(kino, "d:8316")).ids, { tmdb: 4242 });
  assert.deepEqual((await details(kino, "d:8316")).ids, { tmdb: 4242 });
  assert.equal(searches, 1);
});

test("a title TMDB does not know, or a failing kino.tmdb, leaves details without ids", async () => {
  assert.equal((await details(serve(async () => ({ results: [{ id: 9, name: "Unrelated" }] })), "d:8316")).ids, undefined);
  const info = await details(serve(async () => { throw new Error("boom"); }), "d:8316");
  assert.equal(info.title, drama.title);
  assert.equal(info.ids, undefined);
});

test("without kino.tmdb, details keeps its fields and heroPicks still returns heroes without a logo", async () => {
  const kino = serve(undefined);
  assert.equal(typeof kino.tmdb, "undefined");
  const info = await details(kino, "d:8316");
  assert.equal(info.title, drama.title);
  assert.equal("ids" in info, false);
  const picks = await heroPicks(kino, rows, 5);
  assert.equal(picks.length, 1);
  assert.equal("logo" in picks[0].item, false);
});

const withLogos = (logos) => async (path) => (path.startsWith("/search") ? { results: [hit] } : { images: { logos } });

test("a hero pick gets the logo, Spanish before English before no language; none when TMDB has none", async () => {
  const logos = [
    { file_path: "/nolang.png", iso_639_1: null },
    { file_path: "/en.png", iso_639_1: "en" },
    { file_path: "/es.png", iso_639_1: "es" },
  ];
  let picks = await heroPicks(serve(withLogos(logos)), rows, 5);
  assert.equal(picks[0].item.logo, "https://image.tmdb.org/t/p/w500/es.png");
  picks = await heroPicks(serve(withLogos(logos.slice(0, 2))), rows, 5);
  assert.equal(picks[0].item.logo, "https://image.tmdb.org/t/p/w500/en.png");
  picks = await heroPicks(serve(withLogos(logos.slice(0, 1))), rows, 5);
  assert.equal(picks[0].item.logo, "https://image.tmdb.org/t/p/w500/nolang.png");
  picks = await heroPicks(serve(withLogos([])), rows, 5);
  assert.equal("logo" in picks[0].item, false);
  assert.ok(picks[0].text);
});
