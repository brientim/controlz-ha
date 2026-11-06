import { KIND } from "./model.js";

export const TILE_TAGS = {
  [KIND.LIGHT]: "controlz-light-tile",
  [KIND.SWITCH]: "controlz-light-tile",
  [KIND.OUTLET]: "controlz-light-tile",
  [KIND.COVER]: "controlz-cover-tile",
  [KIND.MOTION]: "controlz-sensor-tile",
  [KIND.SENSOR]: "controlz-sensor-tile",
  [KIND.SECURITY]: "controlz-security-tile",
  [KIND.SCENE]: "controlz-scene-tile",
  [KIND.AUTOMATION]: "controlz-automation-tile",
  [KIND.CLIMATE]: "controlz-climate-tile",
  [KIND.FAN]: "controlz-fan-tile",
  [KIND.CAMERA]: "controlz-camera-tile",
  [KIND.MEDIA]: "controlz-media-tile",
  [KIND.OTHER]: "controlz-other-tile",
  room: "controlz-room-card",
};

export function createTile(kind, config, hass) {
  const el = document.createElement(TILE_TAGS[kind] || TILE_TAGS[KIND.OTHER]);
  el.setConfig(config);
  if (hass) el.hass = hass;
  return el;
}
