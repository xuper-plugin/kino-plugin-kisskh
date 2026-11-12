// KissKH: stub exports for every capability the manifest declares. Real logic arrives in later tasks.
import { t } from "./i18n.js";

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
  return [];
}

/** `browse(ref, cursor)`: a "Ver más" page of a row or a category tile. */
export async function browse() {
  return { items: [] };
}

/** `section({ tab })`: the plugin's own section. */
export async function section() {
  return [];
}

/** `categories()`: genre tiles. */
export async function categories() {
  return [];
}

/** `episodes(ref)`: a series' episodes. */
export async function episodes() {
  return [];
}

/** `details(ref)`: a title's detail page. */
export async function details() {
  throw unavailable("details");
}

/** `resolve(ref)`: the Stream to play. */
export async function resolve() {
  throw unavailable("resolve");
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
