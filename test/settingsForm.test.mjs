import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fakeKino, fixture } from "./helpers/fakeKino.mjs";
import { settingsStatus, action, validateSettings } from "../src/plugin.js";
import { panel, panelAction } from "../src/panel/index.js";
import { writeLast } from "../src/panel/state.js";
import { readSettings } from "../src/settings.js";
import { KEYS } from "../src/i18n.js";

const manifest = JSON.parse(readFileSync(new URL("../kino-plugin.json", import.meta.url)));
const VALUE_KEYS = ["preferredSubLang", "maxQuality", "homeRows", "forceBrowserLane"];
const withKino = async (kino, fn) => { globalThis.kino = kino; try { return await fn(); } finally { delete globalThis.kino; } };
const flat = (els) => els.flatMap((e) => (e.children ? flat(e.children) : [e]));
const site = () => fakeKino({
  fetch: async (url) => url.includes("/Episode/") ? { status: 200, body: fixture("episode_mp4.json") }
    : url.includes("/List") ? { status: 200, body: fixture("list.json") } : { status: 404, body: "" },
});

test("settingsStatus answers a health line, before and after a probe", async () => {
  const { kino } = site();
  const before = await withKino(kino, () => settingsStatus());
  assert.equal(typeof before.health, "string");
  assert.ok(before.health.length > 0);
  const out = await withKino(kino, () => action("probe"));
  assert.ok(out.message);
  const after = await withKino(kino, () => settingsStatus());
  assert.notEqual(after.health, before.health);
});

test("a failing probe is reported in the health line", async () => {
  const { kino } = fakeKino({ fetch: async () => ({ status: 503, body: "" }) });
  await withKino(kino, () => action("probe"));
  const s = await withKino(kino, () => settingsStatus());
  assert.match(s.health, /falla/);
});

test("validateSettings: an unknown option is an error, a valid set is null", async () => {
  const { kino } = fakeKino();
  const bad = await withKino(kino, () => validateSettings({ preferredSubLang: "xx" }));
  assert.equal(typeof bad, "string");
  assert.ok(bad.length > 0);
  assert.equal(typeof await withKino(kino, () => validateSettings({ maxQuality: "4k" })), "string");
  assert.equal(await withKino(kino, () => validateSettings({ preferredSubLang: "es", maxQuality: "720p", homeRows: true })), null);
  assert.equal(await withKino(kino, () => validateSettings({})), null);
});

test("resetPrefs names the value keys; clearCache removes only the cache keys", async () => {
  const { kino } = fakeKino();
  kino.storage.set("pp:last:e:1", "{}");
  kino.storage.set("pp:latest", "{}");
  kino.storage.set("health", "{}");
  const r = await withKino(kino, () => action("resetPrefs"));
  assert.ok(r.message);
  assert.deepEqual([...r.clearSettings].sort(), [...VALUE_KEYS].sort());
  const c = await withKino(kino, () => action("clearCache"));
  assert.ok(c.message);
  assert.ok(!kino.storage.get("pp:last:e:1"));
  assert.ok(!kino.storage.get("pp:latest"));
  assert.equal(kino.storage.get("health"), "{}");
  assert.equal(await withKino(kino, () => action("nope")), null);
});

test("the manifest declares the status and the three actions with ES and EN text", () => {
  for (const key of ["health", "probe", "clearCache", "resetPrefs"]) {
    const s = manifest.settings.find((x) => x.key === key);
    assert.ok(s, key);
    assert.ok(s.label && s.labelEn, key);
  }
  assert.ok(manifest.settings.find((x) => x.key === "resetPrefs").confirmEn);
  for (const s of manifest.settings.filter((x) => x.type === "section")) assert.ok(s.label && s.labelEn);
});

test("panel: the subtitle languages are the stream's tracks and picking one is remembered", async () => {
  const { kino } = fakeKino();
  writeLast(kino, "e:1:2:1", { langs: [{ lang: "en", label: "English" }, { lang: "id", label: "Indonesia" }] });
  const ctx = { kind: "series", ref: "e:1:2:1", values: { video: {}, plugin: {} } };
  const shown = await withKino(kino, () => panel(ctx));
  const sel = flat(shown.elements).find((e) => e.key === "preferredSubLang");
  assert.deepEqual(sel.options.map((o) => o.value), ["en", "id"]);
  const out = await withKino(kino, () => panelAction({ key: "preferredSubLang", trigger: "change", value: "id", values: {} }, ctx));
  assert.deepEqual(out.values, { preferredSubLang: "id" });
  assert.equal(readSettings(kino).preferredSubLang, "id");
  const q = await withKino(kino, () => panelAction({ key: "maxQuality", trigger: "change", value: "720p", values: {} }, ctx));
  assert.deepEqual(q.save, ["maxQuality"]);
  assert.equal(readSettings(kino).maxQuality, "720p");
  assert.equal(await withKino(kino, () => panelAction({ key: "maxQuality", trigger: "change", value: "9k", values: {} }, ctx)), null);
  const r = await withKino(kino, () => panelAction({ key: "reset", trigger: "press", values: {} }, ctx));
  assert.deepEqual(r.save, ["preferredSubLang", "maxQuality"]);
  assert.equal(readSettings(kino).preferredSubLang, "en");
});

test("i18n: ES and EN have the same keys, and no user-facing text is a literal in src/", () => {
  assert.deepEqual([...KEYS.es].sort(), [...KEYS.en].sort());
  const files = [];
  const walk = (d) => readdirSync(new URL(d, import.meta.url), { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(d + e.name + "/") : files.push(d + e.name)));
  walk("../src/");
  const bad = [];
  for (const f of files.filter((f) => f.endsWith(".js") && !f.endsWith("i18n.js"))) {
    const src = readFileSync(new URL(f, import.meta.url), "utf8");
    // user text reaches Kino through these members only
    for (const m of src.matchAll(/\b(?:userMessage|message|text|textEn|label|labelEn|title)\s*:\s*(["'`])((?:(?!\1).)*)\1/g)) {
      if (/[\p{L}]{3,}\s+[\p{L}]{2,}/u.test(m[2]) && !m[2].includes("${")) bad.push(`${f}: ${m[0]}`);
    }
  }
  assert.deepEqual(bad, []);
});
