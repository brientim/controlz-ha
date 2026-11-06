/**
 * Weather page model (ControlZ Weather room): current conditions, hourly and daily forecast rows,
 * and the sun from `sun.sun`. Pure: unit tested in test/weather-model.test.js.
 */

/** Home Assistant weather conditions → ControlZ-style emoji and words. */
export const CONDITIONS = Object.freeze({
  "clear-night": { emoji: "🌙", label: "Clear" },
  cloudy: { emoji: "☁️", label: "Cloudy" },
  exceptional: { emoji: "⚠️", label: "Exceptional" },
  fog: { emoji: "🌫️", label: "Fog" },
  hail: { emoji: "🌨️", label: "Hail" },
  lightning: { emoji: "🌩️", label: "Lightning" },
  "lightning-rainy": { emoji: "⛈️", label: "Thunderstorms" },
  partlycloudy: { emoji: "⛅", label: "Partly cloudy" },
  pouring: { emoji: "🌧️", label: "Heavy rain" },
  rainy: { emoji: "🌦️", label: "Rain" },
  snowy: { emoji: "❄️", label: "Snow" },
  "snowy-rainy": { emoji: "🌨️", label: "Sleet" },
  sunny: { emoji: "☀️", label: "Sunny" },
  windy: { emoji: "💨", label: "Windy" },
  "windy-variant": { emoji: "🌬️", label: "Windy and cloudy" },
});

export const condition = (state) => CONDITIONS[state] || { emoji: "🌡️", label: String(state || "Unknown").replace(/[-_]/g, " ") };

const WEATHER_FORECAST_DAILY = 1;
const WEATHER_FORECAST_HOURLY = 2;
const WEATHER_FORECAST_TWICE_DAILY = 4;

/** Forecast types a weather entity offers (`daily`, `hourly`, `twice_daily`), for `weather/subscribe_forecast`. */
export function forecastTypes(stateObj) {
  const f = stateObj?.attributes?.supported_features ?? 0;
  return [
    f & WEATHER_FORECAST_HOURLY && "hourly",
    f & WEATHER_FORECAST_DAILY ? "daily" : f & WEATHER_FORECAST_TWICE_DAILY ? "twice_daily" : null,
  ].filter(Boolean);
}

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

/** `135` → `SE`; text bearings pass through. */
export function compass(bearing) {
  const n = Number(bearing);
  if (bearing == null || bearing === "") return "";
  if (!Number.isFinite(n)) return String(bearing);
  return COMPASS[Math.round((((n % 360) + 360) % 360) / 22.5) % 16];
}

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const round = (v) => (num(v) == null ? null : Math.round(v));

/** Current conditions from a weather entity: condition, temperature, feels like, humidity, wind, pressure, UV. */
export function weatherNow(stateObj) {
  const a = stateObj?.attributes || {};
  const c = condition(stateObj?.state);
  const unit = a.temperature_unit || "°C";
  const wind = num(a.wind_speed);
  return {
    name: a.friendly_name || "Weather",
    offline: !stateObj || ["unavailable", "unknown"].includes(stateObj.state),
    emoji: c.emoji,
    label: c.label,
    temperature: num(a.temperature),
    feels: num(a.apparent_temperature),
    unit,
    humidity: num(a.humidity),
    wind: wind == null ? "" : `${Math.round(wind)} ${a.wind_speed_unit || "km/h"}${compass(a.wind_bearing) ? ` ${compass(a.wind_bearing)}` : ""}`,
    gust: num(a.wind_gust_speed),
    pressure: num(a.pressure) == null ? "" : `${Math.round(a.pressure)} ${a.pressure_unit || "hPa"}`,
    uv: num(a.uv_index),
    visibility: num(a.visibility) == null ? "" : `${a.visibility} ${a.visibility_unit || "km"}`,
  };
}

/** Next `count` hourly rows from now: hour, emoji, temperature, chance of rain. */
export function hourlyRows(forecast, now = Date.now(), count = 24) {
  return (forecast || [])
    .map((f) => ({ ...f, t: Date.parse(f.datetime) }))
    .filter((f) => Number.isFinite(f.t) && f.t >= now - 3_600_000)
    .slice(0, count)
    .map((f) => ({
      t: f.t, emoji: condition(f.condition).emoji, label: condition(f.condition).label,
      temperature: round(f.temperature), rain: round(f.precipitation_probability),
    }));
}

/** Next `count` days: day, emoji, high, low, chance of rain, rain amount. Twice-daily forecasts are merged per day. */
export function dailyRows(forecast, count = 7) {
  const days = new Map();
  for (const f of forecast || []) {
    const t = Date.parse(f.datetime);
    if (!Number.isFinite(t)) continue;
    const key = new Date(t).toDateString();
    const day = days.get(key) || { t, high: null, low: null, rain: null, amount: null, condition: f.condition };
    const high = num(f.temperature);
    const low = num(f.templow);
    if (high != null) day.high = day.high == null ? high : Math.max(day.high, high);
    if (low != null || high != null) day.low = day.low == null ? low ?? high : Math.min(day.low, low ?? high);
    if (num(f.precipitation_probability) != null) day.rain = Math.max(day.rain ?? 0, f.precipitation_probability);
    if (num(f.precipitation) != null) day.amount = (day.amount ?? 0) + f.precipitation;
    if (f.is_daytime !== false) day.condition = f.condition;
    days.set(key, day);
  }
  return [...days.values()].slice(0, count).map((d) => ({
    t: d.t, emoji: condition(d.condition).emoji, label: condition(d.condition).label,
    high: round(d.high), low: d.low === d.high ? null : round(d.low), rain: round(d.rain),
    amount: d.amount == null ? null : Math.round(d.amount * 10) / 10,
  }));
}

/** Sun card from `sun.sun`: up or down, elevation, next sunrise / sunset / dawn / dusk (ms). */
export function sunView(stateObj) {
  const a = stateObj?.attributes || {};
  const t = (v) => (Number.isFinite(Date.parse(v)) ? Date.parse(v) : null);
  return {
    known: !!stateObj,
    up: stateObj?.state === "above_horizon",
    elevation: num(a.elevation),
    azimuth: num(a.azimuth),
    sunrise: t(a.next_rising),
    sunset: t(a.next_setting),
    dawn: t(a.next_dawn),
    dusk: t(a.next_dusk),
  };
}

/** Weather entity for the page: `weather_entity` when it exists, else the first one by id. */
export function pickWeather(hass, preferred) {
  if (preferred && hass?.states?.[preferred]) return preferred;
  return Object.keys(hass?.states || {}).filter((id) => id.startsWith("weather.")).sort()[0] || null;
}
