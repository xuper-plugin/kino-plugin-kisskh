// Person-facing words in Spanish (Bogotá, tuteo) and English, picked by kino.lang.
//
// `t(key, kino)`: callers that hold a kino pass it (the resolver and the tests do); without one the
// global `kino` Kino installs is read at call time, never at import time, so no module imports
// another just to reach kino and the language follows the person's current setting.

const WORDS = {
  es: {
    notFound: "No encontré este título en KissKH.",
    tabHome: "Inicio",
    watch: "Ver",
    close: "Cerrar",
    allCountries: "Todos",
    screenFailTitle: "No pude cargar KissKH",
    screenFailText: "Revisa tu conexión e inténtalo de nuevo.",
    logoAlt: "KissKH",
    search: "Buscar",
    searchClose: "Cerrar la búsqueda",
    searchHint: "Título, actor o palabra",
    searchPrompt: "Escribe para buscar en KissKH",
    searchNone: "Sin resultados",
    tabDramas: "Dramas",
    tabMovies: "Películas",
    tabAnime: "Anime",
    rowLatest: "Novedades",
    rowLastUpdate: "Últimas actualizaciones",
    rowTopRating: "Mejor valorados",
    rowMostViewKr: "Más vistos (Corea)",
    rowMostViewCn: "Más vistos (China)",
    rowMostSearch: "Más buscados",
    rowUpcoming: "Próximamente",
    rowHollywood: "Hollywood",
    rowNewest: "Recién agregados",
    rowSeries: "Dramas",
    rowMovies: "Películas",
    rowAnime: "Anime",
    catDramas: "Dramas",
    catMovies: "Películas",
    catAnime: "Anime",
    catHollywood: "Hollywood",
    catKorean: "Coreanos",
    catChinese: "Chinos",
    catJapanese: "Japoneses",
    catThai: "Tailandeses",
    catTaiwanese: "Taiwaneses",
    catFilipino: "Filipinos",
    catWestern: "Occidentales",
    rowThai: "Tailandeses",
    rowJapanese: "Japoneses",
    rowTaiwanese: "Taiwaneses",
    unavailable: "KissKH no está disponible ahora. Intenta de nuevo en un rato.",
    healthApi: "Catálogo",
    healthSigner: "Reproducción",
    healthOk: "ok",
    healthFail: "falla",
    healthNone: "sin probar",
    probeDone: "Catálogo: {api}. Reproducción: {signer}.",
    cacheCleared: "Listo: {n} registros borrados.",
    cacheClearedOne: "Listo: 1 registro borrado.",
    prefsReset: "Preferencias restablecidas.",
    badOption: "Elige un valor de la lista para «{what}».",
    whatSubLang: "Idioma de subtítulos",
    whatQuality: "Calidad máxima",
    panelTitle: "KissKH",
    prefSubLang: "Subtítulos",
    prefMaxQuality: "Calidad máxima",
    prefNow: "Ahora: subtítulos «{lang}» · calidad {quality}.",
    prefNoTracks: "Esta pantalla muestra los idiomas del capítulo que reproduces; abre uno para elegir entre ellos.",
    prefApplies: "Se aplica al abrir el próximo capítulo.",
    prefReset: "Restablecer",
    prefResetConfirm: "¿Volver a los valores de fábrica?",
    prefSaved: "Listo: se aplica en el próximo capítulo.",
    qAuto: "Automática",
    qUpTo: "Hasta {v}",
    qUpTo480: "Hasta 480p (ahorra datos)",
  },
  en: {
    notFound: "I could not find this title on KissKH.",
    tabHome: "Home",
    watch: "Watch",
    close: "Close",
    allCountries: "All",
    screenFailTitle: "Could not load KissKH",
    screenFailText: "Check your connection and try again.",
    logoAlt: "KissKH",
    search: "Search",
    searchClose: "Close search",
    searchHint: "Title, actor or keyword",
    searchPrompt: "Type to search KissKH",
    searchNone: "No results",
    tabDramas: "Dramas",
    tabMovies: "Movies",
    tabAnime: "Anime",
    rowLatest: "New releases",
    rowLastUpdate: "Latest updates",
    rowTopRating: "Top rated",
    rowMostViewKr: "Most viewed (Korea)",
    rowMostViewCn: "Most viewed (China)",
    rowMostSearch: "Most searched",
    rowUpcoming: "Coming soon",
    rowHollywood: "Hollywood",
    rowNewest: "Recently added",
    rowSeries: "Dramas",
    rowMovies: "Movies",
    rowAnime: "Anime",
    catDramas: "Dramas",
    catMovies: "Movies",
    catAnime: "Anime",
    catHollywood: "Hollywood",
    catKorean: "Korean",
    catChinese: "Chinese",
    catJapanese: "Japanese",
    catThai: "Thai",
    catTaiwanese: "Taiwanese",
    catFilipino: "Filipino",
    catWestern: "Western",
    rowThai: "Thai",
    rowJapanese: "Japanese",
    rowTaiwanese: "Taiwanese",
    unavailable: "KissKH is not available right now. Try again in a while.",
    healthApi: "Catalogue",
    healthSigner: "Playback",
    healthOk: "ok",
    healthFail: "failing",
    healthNone: "not tested",
    probeDone: "Catalogue: {api}. Playback: {signer}.",
    cacheCleared: "Done: {n} records cleared.",
    cacheClearedOne: "Done: 1 record cleared.",
    prefsReset: "Preferences reset.",
    badOption: "Pick a value from the list for \"{what}\".",
    whatSubLang: "Subtitle language",
    whatQuality: "Maximum quality",
    panelTitle: "KissKH",
    prefSubLang: "Subtitles",
    prefMaxQuality: "Maximum quality",
    prefNow: "Now: \"{lang}\" subtitles · quality {quality}.",
    prefNoTracks: "This screen lists the languages of the episode you are playing; open one to choose among them.",
    prefApplies: "Applies when the next episode opens.",
    prefReset: "Reset",
    prefResetConfirm: "Go back to the default settings?",
    prefSaved: "Done: applies to the next episode.",
    qAuto: "Automatic",
    qUpTo: "Up to {v}",
    qUpTo480: "Up to 480p (saves data)",
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

/** `t(key)` with its `{name}` placeholders filled from [vars]. */
export function tf(key, vars, kino = globalThis.kino) {
  return t(key, kino).replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null ? String(vars[k]) : m));
}

/** `tf(key, vars)` in both languages: `{ es, en }`, for the panel's `text` / `textEn` twins. */
// A var that is a function is called with the language ("es"/"en"), for values that are themselves words.
export const both = (key, vars) => {
  const one = (lang) => tf(key, vars && Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, typeof v === "function" ? v(lang) : v])), { lang });
  return { es: one("es"), en: one("en") };
};

/** For tests: every key, so both languages can be checked to have the same set. */
export const KEYS = { es: Object.keys(WORDS.es), en: Object.keys(WORDS.en) };
