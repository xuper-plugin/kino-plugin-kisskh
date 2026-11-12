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
