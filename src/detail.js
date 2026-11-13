// A title's detail page and its episode list, over the site's drama endpoint.

import { drama } from "./api.js";
import { titleId } from "./catalog.js";
import { t } from "./i18n.js";
import { matchTmdb } from "./tmdb.js";

/** `details(ref)`: the info of a `d:` title, only the fields that have a value; null for any other ref. */
export async function details(kino, ref) {
  const id = titleId(ref);
  if (!id) return null;
  const d = await drama(id);
  const year = /^(\d{4})-/.exec(d.releaseDate);
  const info = {
    title: d.title,
    overview: d.description,
    poster: d.thumbnail,
    year: year ? +year[1] : null,
    country: d.country,
    status: d.status,
  };
  const out = Object.fromEntries(Object.entries(info).filter(([, v]) => v !== "" && v !== null));
  // With TMDB's id Kino's own page adds the cast, the overview and the backdrop; no match leaves the page as it is.
  const tmdb = await matchTmdb(kino, { title: d.title, year: info.year, kind: d.type === "Movie" ? "movie" : "series" });
  return tmdb ? { ...out, ids: { tmdb } } : out;
}

/** `episodes(ref)`: a series' episodes flat and ascending (the site sends them newest first), season 1; a movie has none. */
export async function episodes(kino, ref) {
  const id = titleId(ref);
  if (!id) throw kino.error("not_found", "not a KissKH title ref", { userMessage: t("notFound", kino) });
  const d = await drama(id);
  const series = { title: d.title, poster: d.thumbnail };
  if (d.type === "Movie" || d.episodes.length <= 1) return { series, episodes: [] };
  const list = d.episodes
    .map((e) => ({ season: 1, number: e.number, ref: `e:${id}:${e.id}:${e.number}` }))
    .sort((a, b) => a.number - b.number);
  return { series, episodes: list };
}
