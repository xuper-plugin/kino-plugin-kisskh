// The person's settings, read from Kino with the manifest defaults applied.

const read = (kino, key) => {
  try {
    return kino.config.get(key);
  } catch (_) {
    return undefined; // no config
  }
};

/** A toggle arrives as true/false (or the text of it): [fallback] unless it says otherwise. */
const toggle = (v, fallback) => (v === true || v === "true" ? true : v === false || v === "false" ? false : fallback);

/** A select's value, or [fallback] when it is unset or empty. */
const choice = (v, fallback) => (typeof v === "string" && v ? v : fallback);

/** `{ preferredSubLang, maxQuality, homeRows, forceBrowserLane }` as the person set them. */
export function readSettings(kino) {
  return {
    preferredSubLang: choice(read(kino, "preferredSubLang"), "en"),
    maxQuality: choice(read(kino, "maxQuality"), "auto"),
    homeRows: toggle(read(kino, "homeRows"), true),
    forceBrowserLane: toggle(read(kino, "forceBrowserLane"), false),
  };
}
