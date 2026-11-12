/**
 * Each Home Assistant user's own Dashtop layout (sections, calendars, to-do lists, tiles), stored
 * like favorites with the frontend user data calls (key `controlz-ha-dashtop`, any user), falling
 * back to this browser's localStorage. Changes broadcast `controlz-ha-dashtop`.
 */
import { normalizeLayout } from "./dashtop-model.js";

export const DASHTOP_EVENT = "controlz-ha-dashtop";
export const DASHTOP_KEY = "controlz-ha-dashtop";
const LOCAL_KEY = "controlz-ha.dashtop";

let layout = normalizeLayout(null);
let loading = null;
let source = null;

const broadcast = () => globalThis.window?.dispatchEvent(new CustomEvent(DASHTOP_EVENT, { detail: layout }));

function readLocal() {
  try {
    return JSON.parse(globalThis.localStorage?.getItem(LOCAL_KEY) || "null");
  } catch {
    return null;
  }
}

function writeLocal(value) {
  try {
    globalThis.localStorage?.setItem(LOCAL_KEY, JSON.stringify(value));
  } catch {
    // Storage disabled: the layout lasts for this page only.
  }
}

/** The current layout (defaults until `loadDashtop` resolves). */
export const dashtopLayout = () => layout;

export function loadDashtop(hass) {
  if (loading || !hass) return loading;
  loading = (async () => {
    try {
      const result = await hass.callWS({ type: "frontend/get_user_data", key: DASHTOP_KEY });
      layout = normalizeLayout(result?.value);
      source = "user";
    } catch {
      layout = normalizeLayout(readLocal());
      source = "local";
    }
    broadcast();
    return layout;
  })();
  return loading;
}

/** Save a new layout for this user (any user). */
export async function saveDashtop(hass, next) {
  await loadDashtop(hass);
  layout = normalizeLayout(next);
  broadcast();
  if (source === "user") {
    try {
      await hass.callWS({ type: "frontend/set_user_data", key: DASHTOP_KEY, value: layout });
      return layout;
    } catch {
      source = "local";
    }
  }
  writeLocal(layout);
  return layout;
}
