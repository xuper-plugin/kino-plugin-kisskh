// resolve(ref): a playable ref -> the Kino Stream. The signed lane asks the site's own Episode endpoint (the kkey signer),
// plays its URL as it is (an IP-locked MP4 or an HLS playlist, neither needs per-request signing) and attaches the
// decrypted subtitles as inline tracks. Any failure there falls back to the browser lane.

import { signVideo, signSub } from "./kkey.js";
import { drama } from "./api.js";
import { get, getJson, ORIGIN, UA } from "./util/http.js";
import { decryptTxt1 } from "./subs.js";
import { readSettings } from "./settings.js";
import { writeLast } from "./panel/state.js";
import * as browserLane from "./browserLane.js";
import { t } from "./i18n.js";

export { viaBrowser } from "./browserLane.js";

const API = ORIGIN + "/api";
const MAX_SUBTITLES = 30;

/**
 * "e:<drama>:<episode>:<number>", "m:<drama>" or "d:<drama>" -> { dramaId, episodeId, number } (a movie's episode is looked up), else null.
 * A `d:` ref reaches resolve only for a movie-kind tile (a series goes through episodes() and gets `e:` refs), so it plays the first episode. */
async function parsePlay(ref) {
  const s = String(ref || "");
  const e = /^e:(\d{1,9}):(\d{1,9}):(\d+(?:\.\d+)?)$/.exec(s);
  if (e) return { dramaId: e[1], episodeId: +e[2], number: parseFloat(e[3]) };
  const m = /^[md]:(\d{1,9})$/.exec(s);
  if (!m) return null;
  const first = (await drama(m[1])).episodes[0];
  return first ? { dramaId: m[1], episodeId: first.id, number: first.number } : null;
}

/** The playable Video URL of an Episode answer; an upcoming episode answers a widget, not a stream. */
export async function videoUrl(kino, episodeId) {
  const r = await get(`${API}/DramaList/Episode/${episodeId}.png?err=false&ts=&time=&kkey=${signVideo(episodeId)}`, kino);
  if (r.status !== 200) throw new Error(`Episode answered ${r.status}`);
  const url = r.json().Video;
  if (typeof url !== "string" || !/^https:\/\//.test(url)) throw new Error("Episode has no playable Video URL");
  return url;
}

/** One subtitle track as an inline vtt entry, or null when it cannot be fetched or decrypted. */
async function subtitleTrack(kino, track) {
  try {
    const r = await get(track.src, kino);
    if (r.status !== 200) return null;
    return { lang: String(track.land || track.label), label: String(track.label || track.land), format: "vtt", text: decryptTxt1(r.text()).vtt };
  } catch (_) {
    return null;
  }
}

/** Every track of the episode that decrypts, the person's language first. Never throws: no subtitles beats no video. */
async function subtitles(kino, episodeId, preferred) {
  try {
    const list = await getJson(`${API}/Sub/${episodeId}?kkey=${signSub(episodeId)}`, kino);
    const tracks = (await Promise.all((Array.isArray(list) ? list : []).slice(0, MAX_SUBTITLES).map((x) => subtitleTrack(kino, x)))).filter(Boolean);
    return [...tracks.filter((x) => x.lang === preferred), ...tracks.filter((x) => x.lang !== preferred)];
  } catch (_) {
    return [];
  }
}

async function signed(kino, ref, play, settings) {
  const url = await videoUrl(kino, play.episodeId);
  const stream = { url, mime: browserLane.mimeOf(url), headers: { "User-Agent": UA, Referer: ORIGIN + "/" } };
  const subs = await subtitles(kino, play.episodeId, settings.preferredSubLang);
  if (subs.length) stream.subtitles = subs;
  writeLast(kino, ref, { langs: subs.map((x) => ({ lang: x.lang, label: x.label })) });
  return stream;
}

/** `resolve(kino, ref)`: the Stream for an `e:` episode or an `m:`/`d:` movie ref. */
export async function resolve(kino, ref) {
  const play = await parsePlay(ref);
  if (!play) throw kino.error("not_found", "not a playable KissKH ref", { userMessage: t("notFound", kino) });
  const settings = readSettings(kino);
  if (settings.forceBrowserLane) return browserLane.resolve(kino, play);
  try {
    return await signed(kino, ref, play, settings);
  } catch (_) {
    return browserLane.resolve(kino, play);
  }
}
