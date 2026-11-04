/**
 * Hide rooms and devices (dashboard-wide, like ControlZ room / device hiding).
 *
 * Hidden lists live in the ControlZ dashboard config (`hide_areas`, `hide_entities` on the
 * `custom:controlz-rooms` strategy), so every device sees the same thing. Saving needs an admin.
 * After a save, cards update straight away from `override`; the view tabs follow on reload.
 */
export const HIDDEN_EVENT = "controlz-ha-hidden";
export const EDIT_EVENT = "controlz-ha-edit";

const STRATEGY_TYPE = "custom:controlz-rooms";

let override = null;
let editing = false;

export function hiddenLists(config = {}) {
  const lists = override || config;
  return {
    areas: new Set(lists.hide_areas || []),
    entities: new Set(lists.hide_entities || []),
  };
}

export const isEditing = () => editing;

export function setEditing(value) {
  editing = !!value;
  window.dispatchEvent(new CustomEvent(EDIT_EVENT, { detail: { editing } }));
}

/** Lovelace dashboard url_path for the current page (`null` = the default dashboard). */
export function currentDashboardPath() {
  const first = location.pathname.split("/")[1] || "";
  return first === "lovelace" ? null : first;
}

/** Hide (`hide = true`) or show an area or entity by saving the dashboard's strategy config. */
export async function setHidden(hass, kind, id, hide) {
  if (!hass?.user?.is_admin) throw new Error("Only Home Assistant admins can hide rooms and devices.");
  const urlPath = currentDashboardPath();
  const config = await hass.callWS({ type: "lovelace/config", url_path: urlPath, force: false });
  if (config?.strategy?.type !== STRATEGY_TYPE) {
    throw new Error("Hiding works on the ControlZ dashboard (strategy custom:controlz-rooms).");
  }
  const key = kind === "area" ? "hide_areas" : "hide_entities";
  const list = new Set(config.strategy[key] || []);
  if (hide) list.add(id);
  else list.delete(id);
  const strategy = { ...config.strategy, [key]: [...list].sort() };
  if (!strategy[key].length) delete strategy[key];
  await hass.callWS({ type: "lovelace/config/save", url_path: urlPath, config: { ...config, strategy } });
  override = { hide_areas: strategy.hide_areas || [], hide_entities: strategy.hide_entities || [] };
  window.dispatchEvent(new CustomEvent(HIDDEN_EVENT, { detail: override }));
  return override;
}

/** True when this page session changed the hidden rooms (tabs need a reload to follow). */
export const hiddenAreasChangedThisSession = () => override !== null;
