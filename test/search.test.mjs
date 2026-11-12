import test from "node:test";
import assert from "node:assert/strict";
import { fakeKino, fixture } from "./helpers/fakeKino.mjs";
import { search } from "../src/plugin.js";

const params = (url) => Object.fromEntries(new URL(url).searchParams);

function site(searchBody = fixture("search.json")) {
  const { kino, calls } = fakeKino({
    fetch: async (url) => (url.includes("/Search?") ? { status: 200, body: searchBody } : { status: 200, body: fixture("list.json") }),
  });
  globalThis.kino = kino;
  return { kino, calls };
}

test("a plain string searches the site and dresses the matches as tiles", async () => {
  const { calls } = site();
  const items = await search("hidden");
  assert.equal(params(calls[0].url).q, "hidden");
  assert.ok(items.length >= 3);
  assert.deepEqual(items[0], { ref: "d:12552", title: "The Hidden Heir Ye Chen", poster: items[0].poster, kind: "series", episodesCount: 32 });
  assert.deepEqual(await search({ q: "hidden" }), items);
});

test("within a Ver mas page, only that page's titles containing the query are returned", async () => {
  const { calls } = site();
  const r = await search({ q: "FROST", within: "list:1:0:0:1" });
  assert.deepEqual(r.items.map((i) => i.title), ["The First Frost"]);
  assert.ok(calls.every((c) => !c.url.includes("/Search?")));
  assert.ok(calls.every((c) => params(c.url).type === "1"));
  assert.equal(r.next, "4"); // pages 1-3 were read, the site has more
  const genre = await search({ q: "frost", within: "genre:movies" });
  assert.ok(genre.items.length);
  assert.ok((await search({ q: "frost", within: "bogus" })) === null, "an unknown page: Kino filters its own titles");
});

test("query.type puts the hinted kind first and keeps every match", async () => {
  site();
  const all = await search("x");
  const movies = await search({ q: "x", type: "movie" });
  assert.equal(movies.length, all.length);
  assert.ok(all.some((i) => i.kind === "series"));
  const firstNonMovie = movies.findIndex((i) => i.kind !== "movie");
  assert.ok(movies.slice(firstNonMovie).every((i) => i.kind !== "movie"));
  const series = await search({ q: "x", type: "series" });
  assert.equal(series[0].kind, "series");
});
