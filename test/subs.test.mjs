import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decryptTxt1 } from "../src/subs.js";

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const sample = fixture("sample.txt1");

test("decryptTxt1 turns the real English .txt1 into the frozen, readable WebVTT", () => {
  assert.equal(decryptTxt1(sample).vtt, fixture("expected.vtt"));
});

test("the output is valid WebVTT with dotted millisecond timings and readable text", () => {
  const { vtt } = decryptTxt1(sample);
  assert.ok(vtt.startsWith("WEBVTT\n\n"));
  assert.match(vtt, /\n00:00:07\.020 --> 00:00:11\.220\n/);
  assert.ok(!/\d,\d{3} -->/.test(vtt), "no SRT comma timings");
  assert.ok(vtt.includes("I've braved the storms"));
});

test("a corrupt text line blanks only that cue and does not throw", () => {
  const lines = sample.split(/\r?\n/);
  const at = lines.findIndex((l) => l.includes("-->")) + 1;
  lines[at] = "!!!not base64!!!";
  const { vtt } = decryptTxt1(lines.join("\r\n"));
  assert.ok(vtt.includes("I've braved") === false);
  assert.ok(vtt.includes("Seen the highs and lows"));
});

test("a file where nothing decrypts throws", () => {
  assert.throws(() => decryptTxt1("1\r\n00:00:01,000 --> 00:00:02,000\r\n!!!\r\n\r\n"));
  assert.throws(() => decryptTxt1(""));
});
