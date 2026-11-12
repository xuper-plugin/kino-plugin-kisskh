// The fallback lane: when the signer cannot be used, load the site's own watch page in Kino's hidden browser and take
// the media request it makes. It captures the video only, so a title played this way has no subtitles and is not downloadable.

import { ORIGIN, UA } from "./util/http.js";
import { t } from "./i18n.js";

const CAPTURE_MS = 22000;
const HLS = "application/x-mpegURL";

/** The media type a stream URL implies: HLS for a playlist, MP4 otherwise. */
export const mimeOf = (url) => (/\.m3u8(\?|$)/i.test(url) ? HLS : "video/mp4");

const lane = new WeakSet();

/** True for a stream the browser lane produced (the signed lane's streams are downloadable, these are not). */
export const viaBrowser = (stream) => lane.has(stream);

/** The site's watch page of one episode. */
export const watchUrl = ({ dramaId, episodeId, number }) =>
  `${ORIGIN}/Drama/x/Episode-${number}?id=${dramaId}&ep=${episodeId}&page=0&lang=1`;

/** `resolve(kino, play)`: the Stream of `play` ({ dramaId, episodeId, number }) captured from its watch page. */
export async function resolve(kino, play) {
  if (!kino.browser || typeof kino.browser.capture !== "function") {
    throw kino.error("unavailable", "no browser lane on this Kino", { userMessage: t("unavailable", kino) });
  }
  let page;
  try {
    page = await kino.browser.capture(watchUrl(play), { timeoutMs: CAPTURE_MS, match: "\\.m3u8|\\.mp4", headers: { Referer: ORIGIN + "/" } });
  } catch (e) {
    throw kino.error("unavailable", `the watch page could not be captured: ${e && e.message}`, { userMessage: t("unavailable", kino) });
  }
  const media = page.media && page.media[0];
  if (!media || !media.url) throw kino.error("unavailable", "the watch page showed no media", { userMessage: t("unavailable", kino) });
  const stream = {
    url: media.url,
    mime: media.mime || mimeOf(media.url),
    headers: { "User-Agent": UA, Referer: ORIGIN + "/", ...media.headers },
  };
  lane.add(stream);
  return stream;
}
