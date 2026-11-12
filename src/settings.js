// The person's settings, read from Kino with the manifest defaults applied, and the form's validation.

import { readPrefs } from "./panel/state.js";
import { tf, t } from "./i18n.js";

export const QUALITIES = ["auto", "1080p", "720p", "480p"];
export const FORM_LANGS = ["en", "es"];
/** The settings form's value settings: what "reset preferences" clears. */
export const VALUE_KEYS = ["preferredSubLang", "maxQuality", "homeRows", "forceBrowserLane"];

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

/** `{ preferredSubLang, maxQuality, homeRows, forceBrowserLane }`: the form's values, the player panel's override on top. */
export function readSettings(kino) {
  const override = readPrefs(kino);
  return {
    preferredSubLang: choice(override.preferredSubLang, choice(read(kino, "preferredSubLang"), "en")),
    maxQuality: QUALITIES.includes(override.maxQuality) ? override.maxQuality : choice(read(kino, "maxQuality"), "auto"),
    homeRows: toggle(read(kino, "homeRows"), true),
    forceBrowserLane: toggle(read(kino, "forceBrowserLane"), false),
  };
}

/** `validateSettings(kino, values)`: null when every value sent is acceptable, else the localized error (values not sent keep their defaults). */
export function validateSettings(kino, values) {
  const v = values && typeof values === "object" ? values : {};
  if ("preferredSubLang" in v && !FORM_LANGS.includes(v.preferredSubLang)) return tf("badOption", { what: t("whatSubLang", kino) }, kino);
  if ("maxQuality" in v && !QUALITIES.includes(v.maxQuality)) return tf("badOption", { what: t("whatQuality", kino) }, kino);
  return null;
}
