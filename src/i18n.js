// Person-facing words in Spanish (Bogotá, tuteo) and English, picked by kino.lang.
//
// `t(key, kino)`: callers that hold a kino pass it (the resolver and the tests do); without one the
// global `kino` Kino installs is read at call time, never at import time, so no module imports
// another just to reach kino and the language follows the person's current setting.

const WORDS = {
  es: {
    notFound: "No encontré este título en KissKH.",
    tabHome: "Inicio",
    tabDramas: "Dramas",
    tabMovies: "Películas",
    tabAnime: "Anime",
    rowLatest: "Novedades",
    rowSeries: "Dramas",
    rowMovies: "Películas",
    rowAnime: "Anime",
    catDramas: "Dramas",
    catMovies: "Películas",
    catAnime: "Anime",
    catHollywood: "Hollywood",
    unavailable: "KissKH no está disponible ahora. Intenta de nuevo en un rato.",
  },
  en: {
    notFound: "I could not find this title on KissKH.",
    tabHome: "Home",
    tabDramas: "Dramas",
    tabMovies: "Movies",
    tabAnime: "Anime",
    rowLatest: "New releases",
    rowSeries: "Dramas",
    rowMovies: "Movies",
    rowAnime: "Anime",
    catDramas: "Dramas",
    catMovies: "Movies",
    catAnime: "Anime",
    catHollywood: "Hollywood",
    unavailable: "KissKH is not available right now. Try again in a while.",
  },
};

/** "en" when Kino runs in English, else "es". */
export function langOf(kino = globalThis.kino) {
  return String((kino && kino.lang) || "").toLowerCase().startsWith("en") ? "en" : "es";
}

/** The sentence for `key` in the person's language; the Spanish one when English lacks it, the key when both do. */
export function t(key, kino = globalThis.kino) {
  const words = WORDS[langOf(kino)];
  return words[key] ?? WORDS.es[key] ?? key;
}

/** For tests: every key, so both languages can be checked to have the same set. */
export const KEYS = { es: Object.keys(WORDS.es), en: Object.keys(WORDS.en) };
