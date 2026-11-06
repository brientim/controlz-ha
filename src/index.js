import { watchAppearance } from "./appearance.js";
import { AutomationsGrid, FavoritesGrid, HomeGrid, RoomGrid } from "./grids.js";
import { HouseGrid } from "./house-grids.js";
import { WeatherGrid } from "./weather-grid.js";
import { classifyEntity, KIND } from "./model.js";
import { RoomCard } from "./room-card.js";
import { RoomIconsCard } from "./room-icons-card.js";
import { RoomsApp } from "./rooms-app.js";
import { SceneStrip } from "./scene-strip.js";
import { CzSheet } from "./sheet.js";
import { ControlZRoomsStrategy } from "./strategy.js";
import { createTile } from "./tile-factory.js";
import { ViewMenu } from "./view-menu.js";
import { AutomationTile } from "./tiles/automation-tile.js";
import { CameraTile } from "./tiles/camera-tile.js";
import { ClimateTile } from "./tiles/climate-tile.js";
import { CoverTile } from "./tiles/cover-tile.js";
import { FanTile } from "./tiles/fan-tile.js";
import { LightTile } from "./tiles/light-tile.js";
import { MediaTile } from "./tiles/media-tile.js";
import { OtherTile } from "./tiles/other-tile.js";
import { SceneTile } from "./tiles/scene-tile.js";
import { SecurityTile } from "./tiles/security-tile.js";
import { SensorTile } from "./tiles/sensor-tile.js";
import { VERSION } from "./version.js";

/** Public single-entity card: picks the ControlZ tile for the entity's domain / device class. */
class TileCard extends HTMLElement {
  static getStubConfig(hass) {
    const entity = Object.keys(hass?.states || {}).find((id) => id.startsWith("light.")) || "light.example";
    return { entity };
  }

  setConfig(config) {
    if (!config?.entity) throw new Error("controlz-tile-card: `entity` is required");
    this._config = config;
    this._inner = null;
    this.replaceChildren();
    this._build();
  }

  set hass(hass) {
    this._hass = hass;
    this._build();
    if (this._inner) this._inner.hass = hass;
  }

  _build() {
    if (this._inner || !this._hass || !this._config) return;
    const { entity } = this._config;
    const kind = this._config.kind || classifyEntity(entity, this._hass.states[entity], undefined) || KIND.OTHER;
    this._inner = createTile(kind, this._config);
    this.append(this._inner);
  }

  getCardSize() {
    return this._inner?.getCardSize?.() ?? 4;
  }

  getGridOptions() {
    return { columns: 6, min_columns: 3, rows: "auto" };
  }
}

const ELEMENTS = {
  "controlz-light-tile": LightTile,
  "controlz-cover-tile": CoverTile,
  "controlz-sensor-tile": SensorTile,
  "controlz-security-tile": SecurityTile,
  "controlz-scene-tile": SceneTile,
  "controlz-automation-tile": AutomationTile,
  "controlz-climate-tile": ClimateTile,
  "controlz-fan-tile": FanTile,
  "controlz-camera-tile": CameraTile,
  "controlz-media-tile": MediaTile,
  "controlz-other-tile": OtherTile,
  "controlz-room-card": RoomCard,
  "controlz-tile-card": TileCard,
  "controlz-room-grid": RoomGrid,
  "controlz-home-grid": HomeGrid,
  "controlz-favorites-grid": FavoritesGrid,
  "controlz-automations-grid": AutomationsGrid,
  "controlz-house-grid": HouseGrid,
  "controlz-weather-grid": WeatherGrid,
  "controlz-room-icons-card": RoomIconsCard,
  "controlz-scene-strip": SceneStrip,
  "controlz-view-menu": ViewMenu,
  "controlz-sheet": CzSheet,
  "controlz-rooms-app": RoomsApp,
  "ll-strategy-dashboard-controlz-rooms": ControlZRoomsStrategy,
};

for (const [tag, ctor] of Object.entries(ELEMENTS)) {
  if (!customElements.get(tag)) customElements.define(tag, ctor);
}

watchAppearance();

window.customCards = window.customCards || [];
window.customCards.push(
  { type: "controlz-room-card", name: "ControlZ Room", description: "ControlZ room master tile for an area (lights, outlets, coverings).", preview: true },
  { type: "controlz-tile-card", name: "ControlZ Tile", description: "ControlZ device tile (light, cover, thermostat, fan, media, sensor, security, camera, scene, automation).", preview: true },
  { type: "controlz-room-grid", name: "ControlZ Room Page", description: "Full ControlZ room: master tile plus sectioned device tiles." },
  { type: "controlz-home-grid", name: "ControlZ All Rooms", description: "Security banner, All / On / Off filter, maintenance report and a room tile for every area." },
  { type: "controlz-favorites-grid", name: "ControlZ Favorites", description: "Your favorite rooms, scenes and devices (saved per Home Assistant user)." },
  { type: "controlz-automations-grid", name: "ControlZ Automations", description: "Every automation by room: run, enable, edit, duplicate and delete." },
  { type: "controlz-weather-grid", name: "ControlZ Weather", description: "Current weather, the next 24 hours, the next 7 days and the sun (weather_entity: optional)." },
  { type: "controlz-house-grid", name: "ControlZ House page", description: "Every window covering, camera or sensor in the house, by room (page: coverings | cameras | sensors)." },
  { type: "controlz-rooms-app", name: "ControlZ Rooms (sidebar)", description: "Room sidebar with badges plus the selected room — use in a panel view." },
  { type: "controlz-room-icons-card", name: "ControlZ Room Icons", description: "Room icon each area resolves to, plus the searchable ControlZ room icon registry." }
);

console.info(`%c CONTROLZ-HA %c ${VERSION} `, "color:#fff;background:#4f46e5;font-weight:700", "color:#4f46e5;background:#eef2ff");
