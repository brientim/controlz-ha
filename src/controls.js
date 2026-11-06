import { ICONS } from "./icons.js";

const KINDS = {
  brightness: { icon: ICONS.bulb, title: "Brightness", min: 1 },
  position: { icon: ICONS.blinds, title: "Position (100% is open)", min: 0 },
  speed: { icon: ICONS.fan, title: "Fan speed", min: 1 },
  volume: { icon: ICONS.speaker, title: "Volume", min: 0 },
};

/**
 * Slider row shared by every tile. Brightness, covering position, fan speed and volume must never look
 * alike (they sit together on mixed room tiles), so each kind has its own leading icon and fill colour.
 */
export function rangeRow({ kind, action, value, label, extraClass = "", disabled = false }) {
  const k = KINDS[kind];
  return `<div class="row range-row ${kind} ${extraClass}">
    <span class="range-icon" title="${k.title}" aria-hidden="true">${k.icon}</span>
    <input type="range" class="cz-range range-${kind}" min="${k.min}" max="100" value="${value}"
      style="--pct:${value}%" data-action="${action}" aria-label="${label}" ${disabled ? "disabled" : ""} />
    <span class="value">${value}%</span>
  </div>`;
}

/** Keeps the fill and the % label in step while dragging. */
export function syncRange(input) {
  input.style.setProperty("--pct", `${input.value}%`);
  const value = input.parentElement?.querySelector(".value");
  if (value) value.textContent = `${input.value}%`;
}
