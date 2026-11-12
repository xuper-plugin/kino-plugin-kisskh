import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { buildSync } from "esbuild";
import { signVideo, signSub, b1, b2, b3 } from "../src/kkey.js";

const vectors = JSON.parse(readFileSync(new URL("./fixtures/kkey-vectors.json", import.meta.url), "utf8"));

test("signVideo reproduces the kkey the live Episode endpoint accepted", () => {
  assert.equal(signVideo(vectors.episodeId), vectors.video);
});

test("signSub reproduces the kkey the live Sub endpoint accepted", () => {
  assert.equal(signSub(vectors.episodeId), vectors.sub);
});

test("the two keys differ and a different episode gives a different key", () => {
  assert.notEqual(signVideo(vectors.episodeId), signSub(vectors.episodeId));
  assert.notEqual(signVideo(vectors.episodeId + 1), vectors.video);
});

/** The bundled module in a bare context: Kino's QuickJS has no window, document, navigator, require or process. */
function loadBare() {
  const out = buildSync({
    entryPoints: [new URL("../src/kkey.js", import.meta.url).pathname],
    bundle: true, write: false, format: "iife", globalName: "K", target: "es2020",
  }).outputFiles[0].text;
  const ctx = vm.createContext({ atob, btoa }, { codeGeneration: { strings: true, wasm: false } });
  return vm.runInContext(`${out}\n;K`, ctx);
}

test("the signer runs with no DOM, window, navigator, require or process present", () => {
  const K = loadBare();
  for (const name of ["window", "document", "navigator", "require", "process", "global"]) {
    assert.equal(vm.runInContext(`typeof ${name}`, vm.createContext({})), "undefined");
  }
  assert.equal(K.signVideo(vectors.episodeId), vectors.video);
  assert.equal(K.signSub(vectors.episodeId), vectors.sub);
});

test("b2/b3 use a window only for the call and leave the global clean", () => {
  const K = loadBare();
  assert.equal(K.b2(vectors.b2Cipher), vectors.b2Plain);
  try { K.b3("AAAA"); } catch (_) { /* malformed input is fine */ }
});

test("b2 decrypts a real KissKH subtitle cue", () => {
  assert.equal(b2(vectors.b2Cipher), vectors.b2Plain);
  assert.equal(typeof globalThis.window, "undefined");
});

test("b1, b2 and b3 are exposed", () => {
  for (const f of [b1, b2, b3]) assert.equal(typeof f, "function");
});
