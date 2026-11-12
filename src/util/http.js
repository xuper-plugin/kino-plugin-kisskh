import { t } from "../i18n.js";

export const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
export const ORIGIN = "https://kisskh.do";

/** kino.fetch with the browser User-Agent and the Referer KissKH's API expects on every request. */
export const get = (url, kino = globalThis.kino) =>
  kino.fetch(url, { headers: { "User-Agent": UA, Referer: ORIGIN + "/", Accept: "application/json" } });

/**
 * The parsed JSON body of [url]. A body that is not JSON (typically Cloudflare's HTML challenge page) means the site
 * cannot be read right now, so it surfaces as `unavailable` rather than a parse error.
 */
export async function getJson(url, kino = globalThis.kino) {
  const r = await get(url, kino);
  try {
    return r.json();
  } catch (_) {
    throw kino.error("unavailable", `non-JSON body (status ${r.status}) from ${url}`, { userMessage: t("unavailable", kino) });
  }
}
