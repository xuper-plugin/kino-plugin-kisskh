// src/i18n.js
var WORDS = {
  es: {
    notFound: "No encontr\xE9 este t\xEDtulo en KissKH.",
    unavailable: "KissKH no est\xE1 disponible ahora. Intenta de nuevo en un rato."
  },
  en: {
    notFound: "I could not find this title on KissKH.",
    unavailable: "KissKH is not available right now. Try again in a while."
  }
};
function langOf(kino = globalThis.kino) {
  return String(kino && kino.lang || "").toLowerCase().startsWith("en") ? "en" : "es";
}
function t(key, kino = globalThis.kino) {
  const words = WORDS[langOf(kino)];
  return words[key] ?? WORDS.es[key] ?? key;
}
var KEYS = { es: Object.keys(WORDS.es), en: Object.keys(WORDS.en) };

// src/plugin.js
var getKino = () => globalThis.kino;
var unavailable = (what) => {
  const kino = getKino();
  return kino.error("unavailable", `${what}: not implemented yet`, { userMessage: t("unavailable", kino) });
};
async function search() {
  return [];
}
async function home() {
  return [];
}
async function browse() {
  return { items: [] };
}
async function section() {
  return [];
}
async function categories() {
  return [];
}
async function episodes() {
  return [];
}
async function details() {
  throw unavailable("details");
}
async function resolve() {
  throw unavailable("resolve");
}
async function settingsStatus() {
  return {};
}
async function action() {
  return null;
}
async function validateSettings() {
  return null;
}
async function panel() {
  return null;
}
async function panelAction() {
  return null;
}
async function playerEvent() {
  return null;
}
export {
  action,
  browse,
  categories,
  details,
  episodes,
  home,
  panel,
  panelAction,
  playerEvent,
  resolve,
  search,
  section,
  settingsStatus,
  validateSettings
};
