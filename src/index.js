import { HomeGrid, RoomGrid } from "./grids.js";
import { classifyEntity, KIND } from "./model.js";
import { RoomCard } from "./room-card.js";
import { RoomIconsCard } from "./room-icons-card.js";
import { RoomsApp } from "./rooms-app.js";
import { SceneStrip } from "./scene-strip.js";
import { ControlZRoomsStrategy } from "./strategy.js";
import { createTile } from "./tile-factory.js";
import { ViewMenu } from "./view-menu.js";
import { CoverTile } from "./tiles/cover-tile.js";
import { LightTile } from "./tiles/light-tile.js";
import { OtherTile } from "./tiles/other-tile.js";
import { SceneTile } from "./tiles/scene-tile.js";
import { SecurityTile } from "./tiles/security-tile.js";
import { SensorTile } from "./tiles/sensor-tile.js";

const VERSION = __CONTROLZ_HA_VERSION__;

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
  "controlz-other-tile": OtherTile,
  "controlz-room-card": RoomCard,
  "controlz-tile-card": TileCard,
  "controlz-room-grid": RoomGrid,
  "controlz-home-grid": HomeGrid,
  "controlz-room-icons-card": RoomIconsCard,
  "controlz-scene-strip": SceneStrip,
  "controlz-view-menu": ViewMenu,
  "controlz-rooms-app": RoomsApp,
  "ll-strategy-dashboard-controlz-rooms": ControlZRoomsStrategy,
};

for (const [tag, ctor] of Object.entries(ELEMENTS)) {
  if (!customElements.get(tag)) customElements.define(tag, ctor);
}

window.customCards = window.customCards || [];
window.customCards.push(
  { type: "controlz-room-card", name: "ControlZ Room", description: "ControlZ room master tile for an area (lights, outlets, coverings).", preview: true },
  { type: "controlz-tile-card", name: "ControlZ Tile", description: "ControlZ device tile (light, cover, sensor, security, scene).", preview: true },
  { type: "controlz-room-grid", name: "ControlZ Room Page", description: "Full ControlZ room: master tile plus sectioned device tiles." },
  { type: "controlz-home-grid", name: "ControlZ All Rooms", description: "Security banner plus a room tile for every area." },
  { type: "controlz-rooms-app", name: "ControlZ Rooms (sidebar)", description: "Room sidebar with badges plus the selected room — use in a panel view." },
  { type: "controlz-room-icons-card", name: "ControlZ Room Icons", description: "Room icon each area resolves to, plus the searchable ControlZ room icon registry." }
);

console.info(`%c CONTROLZ-HA %c ${VERSION} `, "color:#fff;background:#4f46e5;font-weight:700", "color:#4f46e5;background:#eef2ff");
