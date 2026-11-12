import test from "node:test";
import assert from "node:assert/strict";
import { cached, PENDING_TTL_MS } from "../src/screenCache.js";

const tick = () => new Promise((r) => setTimeout(r, 0));

test("a value is served from the cache within its TTL (one fetch for two reads)", async () => {
  const kino = {};
  let calls = 0;
  const load = () => { calls++; return Promise.resolve("v"); };
  assert.equal(await cached(kino, "k", load), "v");
  assert.equal(await cached(kino, "k", load), "v");
  assert.equal(calls, 1, "the second read is cached");
});

test("a young in-flight fetch is shared, but a stale one is re-fetched instead of hanging forever", async () => {
  const kino = {};
  const realNow = Date.now;
  let now = 1_000_000;
  Date.now = () => now;
  try {
    let calls = 0;
    const neverSettles = () => { calls++; return new Promise(() => {}); }; // the host dropped this fetch; it never settles
    cached(kino, "k", neverSettles);
    cached(kino, "k", neverSettles); // while young: shares the pending, no second fetch
    await tick();
    assert.equal(calls, 1, "a young in-flight fetch is shared");

    now += PENDING_TTL_MS + 1; // the pending has gone stale
    const p = cached(kino, "k", () => { calls++; return Promise.resolve("ok"); });
    await tick();
    assert.equal(calls, 2, "the stale in-flight fetch is retried");
    assert.equal(await p, "ok");
  } finally {
    Date.now = realNow;
  }
});
