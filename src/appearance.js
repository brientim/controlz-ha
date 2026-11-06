import { PREFS_EVENT, readPrefs } from "./prefs.js";

/** Accent colours (ControlZ colour schemes / accent colour), chosen per device in the View menu. */
export const ACCENTS = Object.freeze([
  { id: "controlz", label: "ControlZ indigo", value: "#4f46e5" },
  { id: "ha", label: "Home Assistant theme", value: "var(--primary-color, #03a9f4)" },
  { id: "blue", label: "Blue", value: "#2563eb" },
  { id: "teal", label: "Teal", value: "#0d9488" },
  { id: "green", label: "Green", value: "#16a34a" },
  { id: "amber", label: "Amber", value: "#d97706" },
  { id: "rose", label: "Rose", value: "#e11d48" },
  { id: "slate", label: "Slate", value: "#475569" },
]);

export const CORNERS = Object.freeze([
  { id: "round", label: "Rounded", radius: "16px" },
  { id: "square", label: "Square", radius: "6px" },
]);

export const accentId = () => (ACCENTS.some((a) => a.id === readPrefs().accent) ? readPrefs().accent : "controlz");
export const cornersId = () => (CORNERS.some((c) => c.id === readPrefs().corners) ? readPrefs().corners : "round");

/**
 * Applies this device's accent and corners as CSS custom properties on the document, which every
 * ControlZ shadow root (and the sheets on <body>) inherits.
 */
export function applyAppearance(root = globalThis.document?.documentElement) {
  if (!root?.style) return;
  const accent = ACCENTS.find((a) => a.id === accentId());
  const corners = CORNERS.find((c) => c.id === cornersId());
  if (accent.id === "controlz") root.style.removeProperty("--cz-accent");
  else root.style.setProperty("--cz-accent", accent.value);
  if (corners.id === "round") root.style.removeProperty("--cz-corner");
  else root.style.setProperty("--cz-corner", corners.radius);
}

export function watchAppearance() {
  applyAppearance();
  globalThis.window?.addEventListener(PREFS_EVENT, () => applyAppearance());
}
