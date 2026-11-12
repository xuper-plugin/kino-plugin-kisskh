import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fakeKino, fixture } from "./helpers/fakeKino.mjs";

const manifest = JSON.parse(readFileSync(new URL("../kino-plugin.json", import.meta.url), "utf8"));
const built = await import("../src/plugin.js"); // the bundle is rebuilt by build.test.mjs in parallel; validate.test.mjs checks the built entry

/** Capabilities that are flags on other exports (scopedSearch rides on search, download on resolve), not exports of their own. */
const MODIFIERS = ["scopedSearch", "download"];
const REQUIRED = ["search", "home", "browse", "section", "categories", "episodes", "details", "resolve",
  "screen", "screenEvent", "settingsStatus", "action", "validateSettings", "panel", "panelAction", "playerEvent"];

test("every manifest capability is an exported function of the plugin entry, and the UI exports exist", () => {
  for (const cap of manifest.capabilities.filter((c) => !MODIFIERS.includes(c))) {
    assert.equal(typeof built[cap], "function", `capability ${cap} has no export`);
  }
  for (const name of REQUIRED) assert.equal(typeof built[name], "function", `missing export ${name}`);
  assert.ok(manifest.screen && manifest.screen.menuOpens === "screen" && manifest.panel && manifest.categories.length, "screen, panel and categories are declared");
  assert.equal(built.sign, undefined, "resolve is URL-direct: no sign export");
});

test("end to end: search -> section -> episodes -> resolve gives a playable Stream with inline subtitles", async () => {
  const { kino } = fakeKino({
    fetch: async (url) => {
      if (url.includes("/Search?")) return { status: 200, body: fixture("search.json") };
      if (url.includes("/Episode/")) return { status: 200, body: fixture("episode_mp4.json") };
      if (url.includes("/api/Sub/")) return { status: 200, body: fixture("sublist.json") };
      if (url.includes("/Drama/")) return { status: 200, body: fixture("drama.json") };
      if (url.includes(".srt.txt1")) return { status: 200, body: fixture("sample.txt1") };
      if (url.includes("/DramaList/")) return { status: 200, body: fixture("list.json") };
      return { status: 404, body: "" };
    },
  });
  globalThis.kino = kino;

  const found = await built.search("frost");
  assert.ok(found.length && found.every((i) => i.ref && i.title));

  const sec = await built.section({ tab: "Dramas" });
  assert.equal(sec.tab, "dramas");
  assert.ok(sec.tabs.length >= 4 && sec.rows.length);

  const eps = await built.episodes("d:8316");
  assert.ok(eps.episodes.some((e) => e.ref === "e:8316:174941:1"));

  const stream = await built.resolve("e:8316:174941:1");
  assert.match(stream.url, /^https:\/\//);
  assert.ok(stream.headers && stream.headers.Referer);
  const sub = stream.subtitles.find((s) => s.format === "vtt");
  assert.ok(sub && sub.lang && sub.text.startsWith("WEBVTT"));
});
