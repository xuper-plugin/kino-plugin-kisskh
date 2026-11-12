// A short-lived in-memory cache for the canvas: a rail's items and a hero's overview survive a tab or chip re-tap
// (and the redraw Kino does after every event) instead of being fetched again. Only successes are kept; a request in
// flight is shared, so two draws at once ask the site once. Best effort: a miss just fetches.
export const TTL_MS = 4 * 60 * 1000;
// A request in flight is shared only while it is young: if the host drops a fetch (the drop-pending flag) it may never
// settle, so a `pending` entry older than this is treated as a miss and fetched again instead of hanging on it forever.
export const PENDING_TTL_MS = 30 * 1000;
const MAX_ENTRIES = 80;
// One store per kino object (one per plugin run); tests that build their own kino never see each other's entries.
const stores = new WeakMap();
const storeOf = (kino) => {
  let s = stores.get(kino);
  if (!s) stores.set(kino, (s = new Map()));
  return s;
};

/** `load()`'s result for [key], reused for [ttl] ms. A rejection is not cached. */
export function cached(kino, key, load, ttl = TTL_MS) {
  const store = storeOf(kino);
  const now = Date.now();
  const hit = store.get(key);
  if (hit) {
    if (hit.pending) { if (now - hit.at < PENDING_TTL_MS) return hit.pending; } // a young in-flight fetch is shared; a stale one is re-fetched
    else if (now - hit.at < ttl) return Promise.resolve(hit.value);
  }
  const pending = Promise.resolve().then(load).then(
    (value) => {
      store.set(key, { at: Date.now(), value });
      if (store.size > MAX_ENTRIES) store.delete(store.keys().next().value);
      return value;
    },
    (e) => {
      const cur = store.get(key);
      if (cur && cur.pending === pending) store.delete(key);
      throw e;
    },
  );
  store.set(key, { at: now, pending });
  return pending;
}
