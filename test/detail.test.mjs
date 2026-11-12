import test from "node:test";
import assert from "node:assert/strict";
import { fakeKino, fixture } from "./helpers/fakeKino.mjs";
import { details, episodes } from "../src/detail.js";

const serve = (body) => {
  const { kino } = fakeKino({ fetch: async () => ({ status: 200, body }) });
  globalThis.kino = kino;
  return kino;
};

test("details fills the info from the drama, leaving blanks out", async () => {
  const d = JSON.parse(fixture("drama.json"));
  const info = await details(serve(fixture("drama.json")), "d:8316");
  assert.deepEqual(info, {
    title: d.title, overview: d.description, poster: d.thumbnail,
    year: 2025, country: "China", status: "Completed",
  });
  assert.deepEqual(await details(serve(JSON.stringify({ id: 1, title: "X", episodes: [] })), "d:1"), { title: "X" });
});

test("details gives null for a ref that is not a title", async () => {
  const kino = serve(fixture("drama.json"));
  assert.equal(await details(kino, "x:1"), null);
  assert.equal(await details(kino, "e:8316:1:1"), null);
});

test("episodes lists a series ascending with e: refs and the series block", async () => {
  const kino = serve(fixture("drama.json"));
  const d = JSON.parse(fixture("drama.json"));
  const r = await episodes(kino, "d:8316");
  assert.deepEqual(r.series, { title: d.title, poster: d.thumbnail });
  assert.equal(r.episodes.length, 32);
  assert.deepEqual(r.episodes.map((e) => e.number), Array.from({ length: 32 }, (_, i) => i + 1));
  assert.deepEqual(r.episodes[0], { season: 1, number: 1, ref: `e:8316:${d.episodes[d.episodes.length - 1].id}:1` });
  assert.ok(r.episodes.every((e) => e.season === 1 && e.ref.startsWith("e:8316:")));
  await assert.rejects(() => episodes(kino, "x:1"), (e) => e.code === "not_found");
});

test("a movie has no episodes but still has details", async () => {
  const kino = serve(fixture("movie.json"));
  assert.deepEqual((await episodes(kino, "d:9001")).episodes, []);
  assert.equal((await details(kino, "d:9001")).year, 2019);
});
