import { ORIGIN, getJson } from "./util/http.js";

const API = ORIGIN + "/api/DramaList";

const item = (d) => ({
  id: d.id,
  title: String(d.title ?? ""),
  thumbnail: String(d.thumbnail ?? ""),
  episodesCount: d.episodesCount | 0,
  label: String(d.label ?? ""),
});

/** One catalogue page: { page, pageSize, totalCount, items }. */
export async function list({ page = 1, type = 0, country = 0, status = 0, order = 1, pageSize = 24 } = {}) {
  const j = await getJson(`${API}/List?page=${page}&type=${type}&sub=0&country=${country}&status=${status}&order=${order}&pageSize=${pageSize}`);
  return { page: j.page, pageSize: j.pageSize, totalCount: j.totalCount, items: (j.data || []).map(item) };
}

/** Titles matching [q], flat. */
export async function search(q) {
  const j = await getJson(`${API}/Search?q=${encodeURIComponent(q)}&type=0`);
  return (Array.isArray(j) ? j : []).map(item);
}

/** One title's detail; the episodes stay in the site's order (newest first). */
export async function drama(id) {
  const j = await getJson(`${API}/Drama/${id}?isq=false`);
  return {
    id: j.id,
    title: String(j.title ?? ""),
    description: String(j.description ?? ""),
    country: String(j.country ?? ""),
    status: String(j.status ?? ""),
    type: String(j.type ?? ""),
    releaseDate: String(j.releaseDate ?? ""),
    thumbnail: String(j.thumbnail ?? ""),
    episodes: (j.episodes || []).map((e) => ({ id: e.id, number: e.number, sub: e.sub })),
    episodesCount: j.episodesCount | 0,
  };
}

/** A curated endpoint's items: the site answers a flat array (a `{data}` wrapper is tolerated), normalized like a list page. */
async function curated(path) {
  const j = await getJson(`${API}/${path}`);
  const arr = Array.isArray(j) ? j : j && Array.isArray(j.data) ? j.data : [];
  return arr.filter((d) => d && d.id != null).map(item);
}

/** Recently updated titles. */
export const lastUpdate = () => curated("LastUpdate?ispc=false");
/** Best rated titles. */
export const topRating = () => curated("TopRating?ispc=false");
/** Most viewed titles; the site ignores `country` today (the answer is the same), it is sent as its own page does. */
export const mostView = (country = 1) => curated(`MostView?ispc=false&country=${country | 0}`);
/** The anime shelf. */
export const animate = () => curated("Animate?ispc=false");
/** Most searched titles. */
export const mostSearch = () => curated("MostSearch?ispc=false");
/** Titles announced for later (`label` carries the date, episodesCount may be 0). */
export const upcoming = () => curated("Upcoming?ispc=false");
