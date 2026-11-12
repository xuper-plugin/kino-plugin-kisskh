// KissKH: stub exports for every capability the manifest declares. Real logic arrives in later tasks.
import { t } from "./i18n.js";
import * as catalog from "./catalog.js";
import * as detail from "./detail.js";
import * as playback from "./resolve.js";
import { readSettings } from "./settings.js";

const getKino = () => globalThis.kino;

/** What every capability that has nothing to offer yet throws. */
const unavailable = (what) => {
  const kino = getKino();
  return kino.error("unavailable", `${what}: not implemented yet`, { userMessage: t("unavailable", kino) });
};

/** `search(query)`: matching titles. */
export async function search() {
  return [];
}

/** `home()`: the rows shown on Kino's Home. */
export async function home() {
  const kino = getKino();
  return catalog.home(kino, readSettings(kino));
}

/** `browse(ref, cursor)`: a "Ver más" page of a row or a category tile. */
export async function browse(ref, cursor) {
  return catalog.browse(getKino(), ref, cursor);
}

/** `section({ tab })`: the plugin's own section. */
export async function section(arg) {
  const kino = getKino();
  return catalog.section(kino, readSettings(kino), arg && arg.tab);
}

/** `categories()`: genre tiles. */
export async function categories() {
  return catalog.categories(getKino());
}

/** `episodes(ref)`: a series' episodes. */
export async function episodes(ref) {
  return detail.episodes(getKino(), ref);
}

/** `details(ref)`: a title's detail page. */
export async function details(ref) {
  return detail.details(getKino(), ref);
}

/** `resolve(ref)`: the Stream to play. */
export async function resolve(ref) {
  return playback.resolve(getKino(), ref);
}

/** `settingsStatus()`: the status line in the settings form. */
export async function settingsStatus() {
  return {};
}

/** `action(key)`: the settings form's buttons. */
export async function action() {
  return null;
}

/** `validateSettings(values)`: null when the form's values are acceptable. */
export async function validateSettings() {
  return null;
}

/** `panel(ctx)`: the player panel. */
export async function panel() {
  return null;
}

/** `panelAction(ctx)`: a press in the player panel. */
export async function panelAction() {
  return null;
}

/** `playerEvent(event)`: a player event. */
export async function playerEvent() {
  return null;
}
