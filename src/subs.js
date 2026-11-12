import { b2 } from "./kkey.js";

const TIMING = /^(\d{2}:\d{2}:\d{2}),(\d{3}) --> (\d{2}:\d{2}:\d{2}),(\d{3})/;

/** The plaintext of one encrypted text line, or "" when it does not decrypt (b2 is the site's `.txt1` cipher). */
function decryptLine(line) {
  try {
    return b2(line) || "";
  } catch (_) {
    return "";
  }
}

/**
 * KissKH `.txt1` -> WebVTT. The file is an SRT whose indices and timings are plain and whose text lines are each
 * AES-encrypted and base64-encoded. A line that does not decrypt blanks only its cue; a file where no line decrypts
 * throws, so the caller can drop the track.
 */
export function decryptTxt1(text) {
  const cues = [];
  let decrypted = 0;
  for (const block of text.split(/\r?\n\r?\n/)) {
    const lines = block.split(/\r?\n/).filter((l) => l.trim());
    const at = lines.findIndex((l) => TIMING.test(l));
    if (at < 0) continue;
    const m = TIMING.exec(lines[at]);
    const body = lines.slice(at + 1).map(decryptLine);
    decrypted += body.filter(Boolean).length;
    const caption = body.filter(Boolean).join("\n");
    if (caption) cues.push(`${m[1]}.${m[2]} --> ${m[3]}.${m[4]}\n${caption}`);
  }
  if (!decrypted) throw new Error("no subtitle line decrypted");
  return { vtt: `WEBVTT\n\n${cues.join("\n\n")}\n` };
}
