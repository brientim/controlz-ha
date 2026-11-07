import { escapeHtml } from "./base.js";
import { CzPage } from "./grids.js";
import { ICONS } from "./icons.js";
import { formatTemp } from "./model.js";
import { dailyRows, forecastTypes, hourlyRows, pickWeather, sunView, weatherNow } from "./weather-model.js";

const WEATHER_ICON = ICONS.weather;

const time = (t) => (t ? new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—");
const hour = (t) => new Date(t).toLocaleTimeString([], { hour: "numeric" });
const day = (t, i) => (i === 0 ? "Today" : new Date(t).toLocaleDateString([], { weekday: "short" }));

/**
 * Weather page (ControlZ Weather room): current conditions, the next 24 hours, the next 7 days and
 * the sun, from a Home Assistant weather entity (`weather_entity`, else the first one) and `sun.sun`.
 * Forecasts come from `weather/subscribe_forecast`, so they stay live while the page is open.
 */
export class WeatherGrid extends CzPage {
  static getStubConfig() {
    return {};
  }

  constructor() {
    super();
    this._forecast = {};
    this._unsubs = [];
    this._subFor = null;
  }

  connectedCallback() {
    super.connectedCallback();
    if (this._hass && this._config) this.update();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubscribe();
  }

  _unsubscribe() {
    for (const p of this._unsubs) Promise.resolve(p).then((off) => off?.()).catch(() => {});
    this._unsubs = [];
    this._subFor = null;
    this._forecast = {};
  }

  _subscribe(entityId) {
    if (this._subFor === entityId || !this.isConnected) return;
    this._unsubscribe();
    this._subFor = entityId;
    const conn = this._hass.connection;
    if (!conn?.subscribeMessage || !entityId) return;
    for (const type of forecastTypes(this._hass.states[entityId])) {
      try {
        this._unsubs.push(conn.subscribeMessage((msg) => {
          this._forecast = { ...this._forecast, [type === "twice_daily" ? "daily" : type]: msg?.forecast || [] };
          this._html = null;
          this.update();
        }, { type: "weather/subscribe_forecast", forecast_type: type, entity_id: entityId }).catch(() => null));
      } catch {
        // Older Home Assistant: the forecast attribute below is used instead.
      }
    }
  }

  bannerArea() {
    return "page:weather";
  }

  _entity() {
    return pickWeather(this._hass, this._config.weather_entity);
  }

  structureKey() {
    return this._entity() || "";
  }

  build(page) {
    const name = this._config.title || "Weather";
    this.header(page, `<h1 class="page-title"><span class="title-icon">${WEATHER_ICON}</span>${escapeHtml(name)}<span class="readings-inline"></span></h1>`,
      { id: "weather", name });
    this._html = null;
    page.insertAdjacentHTML("beforeend", `<div class="wx-body"></div>`);
  }

  update() {
    const body = this.shadowRoot.querySelector(".wx-body");
    if (!body) return;
    const entityId = this._entity();
    if (!entityId) {
      const html = `<div class="empty">No weather in Home Assistant yet. Add a weather integration (for example Met.no) under Settings → Devices &amp; services.</div>`;
      if (html !== this._html) body.innerHTML = this._html = html;
      return;
    }
    this._subscribe(entityId);
    const stateObj = this._hass.states[entityId];
    const legacy = Array.isArray(stateObj?.attributes?.forecast) ? stateObj.attributes.forecast : [];
    const hourly = hourlyRows(this._forecast.hourly || [], Date.now());
    const daily = dailyRows(this._forecast.daily || legacy);
    const html = this._render(weatherNow(stateObj), sunView(this._hass.states["sun.sun"]), hourly, daily);
    if (html === this._html) return;
    this._html = html;
    body.innerHTML = html;
    const readings = this.shadowRoot.querySelector(".readings-inline");
    const now = weatherNow(stateObj);
    if (readings) readings.textContent = now.offline ? "" : `${now.label}${now.temperature != null ? ` · ${formatTemp(now.temperature)}` : ""}`;
  }

  _render(now, sun, hourly, daily) {
    const fact = (label, value) => (value === "" || value == null ? "" : `<div class="wx-fact"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`);
    const highs = daily.map((d) => d.high).filter((v) => v != null);
    const lows = daily.map((d) => d.low ?? d.high).filter((v) => v != null);
    const top = Math.max(...highs, -Infinity);
    const bottom = Math.min(...lows, Infinity);
    const bar = (d) => {
      if (d.high == null || !Number.isFinite(top) || top === bottom) return "";
      const lo = d.low ?? d.high;
      return `<span class="wx-range"><span style="left:${((lo - bottom) / (top - bottom)) * 100}%;right:${100 - ((d.high - bottom) / (top - bottom)) * 100}%"></span></span>`;
    };
    return `
      <div class="wx-top">
        <div class="wx-card wx-now">
          <div class="wx-big"><span class="wx-emoji" aria-hidden="true">${now.emoji}</span>
            <span class="wx-temp">${now.temperature == null ? "—" : `${Math.round(now.temperature)}°`}</span></div>
          <div class="wx-label">${escapeHtml(now.label)}${now.feels != null ? ` · feels like ${Math.round(now.feels)}°` : ""}</div>
          <div class="wx-facts">
            ${fact("Humidity", now.humidity == null ? "" : `${Math.round(now.humidity)}%`)}
            ${fact("Wind", now.wind)}
            ${fact("Pressure", now.pressure)}
            ${fact("UV index", now.uv == null ? "" : String(Math.round(now.uv)))}
            ${fact("Visibility", now.visibility)}
          </div>
        </div>
        ${sun.known ? `<div class="wx-card wx-sun">
          <div class="wx-sun-head"><span aria-hidden="true">${sun.up ? "☀️" : "🌙"}</span>
            <strong>${sun.up ? "Sun is up" : "Sun is down"}</strong>${sun.elevation != null ? `<span class="wx-muted">${Math.round(sun.elevation)}° high</span>` : ""}</div>
          <div class="wx-facts">
            ${fact("Sunrise", time(sun.sunrise))}${fact("Sunset", time(sun.sunset))}
            ${fact("Dawn", time(sun.dawn))}${fact("Dusk", time(sun.dusk))}
          </div>
        </div>` : ""}
      </div>
      ${hourly.length ? `<section><h2>Next ${hourly.length} hours</h2><div class="wx-hours" role="list">${hourly.map((h, i) => `
        <div class="wx-hour" role="listitem" title="${escapeHtml(h.label)}"><span class="wx-muted">${i === 0 ? "Now" : escapeHtml(hour(h.t))}</span>
          <span class="wx-emoji-sm" aria-hidden="true">${h.emoji}</span><strong>${h.temperature == null ? "—" : `${h.temperature}°`}</strong>
          <span class="wx-rain">${h.rain ? `💧${h.rain}%` : "&nbsp;"}</span></div>`).join("")}</div></section>` : ""}
      ${daily.length ? `<section><h2>Next ${daily.length} days</h2><div class="wx-days">${daily.map((d, i) => `
        <div class="wx-day"><span class="wx-dayname">${escapeHtml(day(d.t, i))}</span><span class="wx-emoji-sm" aria-hidden="true" title="${escapeHtml(d.label)}">${d.emoji}</span>
          <span class="wx-rain">${d.rain ? `💧${d.rain}%` : ""}</span>
          <span class="wx-lo">${d.low == null ? "" : `${d.low}°`}</span>${bar(d)}<span class="wx-hi">${d.high == null ? "—" : `${d.high}°`}</span></div>`).join("")}</div></section>`
        : `<p class="hint">This weather service gives no forecast.</p>`}`;
  }

  styles() {
    return `
      .wx-top { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr)); gap: 12px; margin-bottom: 22px; }
      .wx-card { border-radius: var(--cz-radius); border: 1px solid var(--cz-border); background: var(--cz-card-bg); padding: 16px; box-shadow: var(--cz-shadow); }
      .wx-now { background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%); border-color: #7dd3fc; color: #0c4a6e; }
      .wx-big { display: flex; align-items: center; gap: 12px; }
      .wx-emoji { font-size: 3rem; line-height: 1; }
      .wx-temp { font-size: 3rem; font-weight: 800; line-height: 1; }
      .wx-label { font-weight: 600; margin: 8px 0 12px; }
      .wx-facts { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px; }
      .wx-fact { display: flex; flex-direction: column; gap: 2px; font-size: 0.85rem; }
      .wx-fact span { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.75; }
      .wx-sun-head { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; font-size: 1.05rem; }
      .wx-muted { color: var(--cz-text-secondary); font-size: 0.8rem; }
      .wx-now .wx-muted { color: inherit; opacity: 0.75; }
      .wx-hours { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 6px; scrollbar-width: thin; }
      .wx-hour {
        display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 64px; padding: 10px 6px; border-radius: 12px;
        border: 1px solid var(--cz-border); background: var(--cz-card-bg); font-size: 0.85rem;
      }
      .wx-emoji-sm { font-size: 1.4rem; line-height: 1.2; }
      .wx-rain { font-size: 0.72rem; color: #2563eb; font-weight: 600; min-height: 1em; }
      .wx-days { display: flex; flex-direction: column; gap: 6px; max-width: 720px; }
      .wx-day {
        display: grid; grid-template-columns: 4.5rem 2rem 3.5rem 2.5rem 1fr 2.5rem; align-items: center; gap: 8px; padding: 8px 12px;
        border-radius: 12px; border: 1px solid var(--cz-border); background: var(--cz-card-bg); font-size: 0.9rem;
      }
      .wx-dayname { font-weight: 700; }
      .wx-lo { text-align: right; color: var(--cz-text-secondary); }
      .wx-hi { font-weight: 700; }
      .wx-range { position: relative; height: 6px; border-radius: 999px; background: var(--cz-bg-secondary); }
      .wx-range span { position: absolute; top: 0; bottom: 0; border-radius: 999px; background: linear-gradient(90deg, #60a5fa, #f59e0b); min-width: 6px; }
    `;
  }
}
