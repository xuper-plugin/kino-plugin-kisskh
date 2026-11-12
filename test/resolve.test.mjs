import test from "node:test";
import assert from "node:assert/strict";
import { fakeKino, fixture } from "./helpers/fakeKino.mjs";
import { resolve, viaBrowser } from "../src/resolve.js";
import { UA } from "../src/util/http.js";

const GOOD_SUB = "https://sub.cdnvideo11.shop/English-EP1-The-First-Frost.srt.txt1?v=1";

/** A scripted site: the Episode and Sub endpoints, the drama detail, and each subtitle file by URL. */
function site({ episode = fixture("episode_mp4.json"), episodeStatus = 200, subs = {}, drama = fixture("drama.json"), config, browser } = {}) {
  const sublist = fixture("sublist.json");
  const files = { [GOOD_SUB]: fixture("sample.txt1"), ...subs };
  const { kino, calls } = fakeKino({
    config,
    extra: browser ? { browser } : {},
    fetch: async (url) => {
      if (url.includes("/Episode/")) return { status: episodeStatus, body: episode };
      if (url.includes("/api/Sub/")) return { status: 200, body: sublist };
      if (url.includes("/Drama/")) return { status: 200, body: drama };
      if (url in files) return { status: 200, body: files[url] };
      return { status: 404, body: "" };
    },
  });
  globalThis.kino = kino;
  return { kino, calls };
}

test("an e: ref resolves to the signed media URL with the browser headers", async () => {
  const { kino, calls } = site();
  const s = await resolve(kino, "e:8316:174941:1");
  assert.equal(s.url, JSON.parse(fixture("episode_mp4.json")).Video);
  assert.equal(s.mime, "video/mp4");
  assert.deepEqual(s.headers, { "User-Agent": UA, Referer: "https://kisskh.do/" });
  const ep = calls.find((c) => c.url.includes("/Episode/174941.png"));
  assert.match(ep.url, /kkey=[0-9A-F]+/i);
  assert.equal(viaBrowser(s), false);
});

test("an HLS title keeps its playlist URL plain with the HLS mime", async () => {
  const { kino } = site({ episode: fixture("episode_hls.json") });
  const s = await resolve(kino, "e:9987:181765:16.5");
  assert.equal(s.url, JSON.parse(fixture("episode_hls.json")).Video);
  assert.equal(s.mime, "application/x-mpegURL");
  assert.equal(s.signing, undefined);
});

test("subtitles are inline vtt tracks, the preferred language first, with no url", async () => {
  const { kino } = site({ config: { preferredSubLang: "id" }, subs: { "https://sub.cdnvideo11.shop/Indonesian-EP1-The-First-Frost.srt.txt1": fixture("sample.txt1") } });
  const s = await resolve(kino, "e:8316:174941:1");
  assert.deepEqual(s.subtitles.map((x) => x.lang), ["id", "en"]);
  const en = s.subtitles.find((x) => x.lang === "en");
  assert.equal(en.format, "vtt");
  assert.equal("url" in en, false);
  assert.equal(en.text, fixture("expected.vtt"));
});

test("an empty signer answer falls back to the browser lane instead of throwing", async () => {
  const captured = [];
  const browser = {
    capture: async (url, opts) => {
      captured.push({ url, opts });
      return { media: [{ url: "https://cdn.example/v.mp4", mime: "video/mp4", headers: { Referer: "https://kisskh.do/", "User-Agent": UA } }], subtitles: [], finalUrl: url };
    },
  };
  const { kino } = site({ episode: "", browser });
  const s = await resolve(kino, "e:8316:174941:1");
  assert.equal(s.url, "https://cdn.example/v.mp4");
  assert.equal(captured[0].url, "https://kisskh.do/Drama/x/Episode-1?id=8316&ep=174941&page=0&lang=1");
  assert.equal(viaBrowser(s), true);
  assert.equal(s.subtitles, undefined);
});

test("an upcoming episode (no playable URL) also falls back, and forceBrowserLane skips the signer", async () => {
  const browser = { capture: async () => ({ media: [{ url: "https://cdn.example/w.m3u8", headers: {} }], subtitles: [], finalUrl: "" }) };
  const a = site({ episode: fixture("episode_upcoming.json"), browser });
  assert.equal(viaBrowser(await resolve(a.kino, "e:1:2:3")), true);
  const b = site({ config: { forceBrowserLane: true }, browser });
  const s = await resolve(b.kino, "e:8316:174941:1");
  assert.equal(viaBrowser(s), true);
  assert.equal(s.mime, "application/x-mpegURL");
  assert.equal(b.calls.some((c) => c.url.includes("/Episode/")), false);
});

test("with no browser and a dead signer the failure is unavailable", async () => {
  const { kino } = site({ episode: "" });
  await assert.rejects(() => resolve(kino, "e:8316:174941:1"), (e) => e.code === "unavailable");
});

test("a .txt1 that does not decrypt drops only that track", async () => {
  const { kino } = site({ subs: { "https://sub.cdnvideo11.shop/Malay-EP1-The-First-Frost.srt.txt1": "1\n00:00:01,000 --> 00:00:02,000\nnot-encrypted\n" } });
  const s = await resolve(kino, "e:8316:174941:1");
  assert.deepEqual(s.subtitles.map((x) => x.lang), ["en"]);
  assert.equal(s.url, JSON.parse(fixture("episode_mp4.json")).Video);
});

test("an m: ref fetches the detail and plays episodes[0]", async () => {
  const movie = JSON.parse(fixture("movie.json"));
  const { kino, calls } = site({ drama: fixture("movie.json") });
  const s = await resolve(kino, "m:9001");
  assert.equal(s.url, JSON.parse(fixture("episode_mp4.json")).Video);
  assert.ok(calls.some((c) => c.url.includes(`/Episode/${movie.episodes[0].id}.png`)));
});

test("a ref that is not playable is not_found", async () => {
  const { kino } = site();
  await assert.rejects(() => resolve(kino, "d:8316"), (e) => e.code === "not_found");
  await assert.rejects(() => resolve(kino, "e:8316:x:1"), (e) => e.code === "not_found");
});

test("downloads: a signed stream is a plain URL, a browser-lane-only title fails cleanly when Kino has no capture", async () => {
  const a = site();
  const s = await resolve(a.kino, "e:8316:174941:1");
  assert.equal(viaBrowser(s), false); // direct URL + headers: downloadable as it is
  const b = site({ episode: "", browser: { capture: async () => ({ media: [], subtitles: [], finalUrl: "" }) } });
  await assert.rejects(() => resolve(b.kino, "e:8316:174941:1"), (e) => e.code === "unavailable"); // no hang, no stream
});
