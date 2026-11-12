import { escapeHtml } from "./base.js";
import { CzPage } from "./grids.js";
import { attentionIgnored, dashboardBatteryThreshold, setAttentionIgnored, setBatteryThreshold } from "./hidden.js";
import { ICONS } from "./icons.js";
import { attentionReport } from "./model.js";
import { BATTERY_MAX, BATTERY_MIN, batteryThresholdOr, effectiveBatteryThreshold, readPrefs, writePrefs } from "./prefs.js";

const STEP = 5;

/**
 * Needs Attention (ControlZ Low Battery Report and orphan repair, on one page): devices not
 * responding, batteries under the low-battery level, orphaned entities and devices in no room,
 * grouped by the nature of the fault. The level is set here, on this device (admins: for everyone);
 * admins can ignore devices they already know about.
 */
export class AttentionGrid extends CzPage {
  static getStubConfig() {
    return {};
  }

  constructor() {
    super();
    this.shadowRoot.addEventListener("click", (ev) => {
      const hit = ev.composedPath().find((el) => el instanceof HTMLElement && el.matches?.(
        "[data-th-step], [data-th-everyone], [data-th-reset], [data-att-open], [data-att-ignore]"));
      if (!hit) return;
      if (hit.dataset.thStep) this._step(Number(hit.dataset.thStep));
      else if (hit.hasAttribute("data-th-everyone")) {
        this._save(async () => {
          await setBatteryThreshold(this._hass, this._threshold());
          writePrefs({ battery_threshold: null });
        }, hit);
      }
      else if (hit.hasAttribute("data-th-reset")) writePrefs({ battery_threshold: null });
      else if (hit.dataset.attIgnore) this._save(() => setAttentionIgnored(this._hass, hit.dataset.attIgnore, hit.dataset.ignore === "1"), hit);
      else this.moreInfo(hit.dataset.attOpen);
    });
  }

  bannerArea() {
    return "page:attention";
  }

  _threshold() {
    return effectiveBatteryThreshold(dashboardBatteryThreshold(this._config));
  }

  prefsChangeStructure() {
    return this._builtThreshold !== this._threshold();
  }

  _report() {
    return attentionReport(this._hass, {
      threshold: this._threshold(),
      exclude: [...this._hiddenSets.entities],
      ignore: [...attentionIgnored(this._config)],
    });
  }

  build(page) {
    const name = this._config.title || "Needs Attention";
    this.header(page, `<h1 class="page-title"><span class="title-icon">${ICONS.alert}</span>${escapeHtml(name)}<span class="readings-inline"></span></h1>`,
      { id: "attention", name });
    this._builtThreshold = this._threshold();
    this._bodyHtml = null;
    page.insertAdjacentHTML("beforeend", `<div class="filter-row att-level">${this._levelHtml()}</div><div class="att-body"></div>`);
  }

  _levelHtml() {
    const level = this._threshold();
    const own = readPrefs().battery_threshold != null;
    const everyone = batteryThresholdOr(dashboardBatteryThreshold(this._config));
    return `
      <span class="att-label">Low battery below</span>
      <span class="stepper" role="group" aria-label="Low-battery level">
        <button type="button" class="step" data-th-step="-${STEP}" ${level <= BATTERY_MIN ? "disabled" : ""} aria-label="Lower">−</button>
        <strong class="step-value">${level}%</strong>
        <button type="button" class="step" data-th-step="${STEP}" ${level >= BATTERY_MAX ? "disabled" : ""} aria-label="Higher">+</button>
      </span>
      <span class="hint">${own ? `On this device (everyone else: ${everyone}%).` : "For everyone on this dashboard."}</span>
      ${own ? `<button type="button" class="head-btn" data-th-reset>Use ${everyone}%</button>` : ""}
      ${own && this._isAdmin ? `<button type="button" class="head-btn" data-th-everyone>Save ${level}% for everyone</button>` : ""}`;
  }

  _step(delta) {
    const next = Math.min(BATTERY_MAX, Math.max(BATTERY_MIN, this._threshold() + delta));
    writePrefs({ battery_threshold: next });
  }

  async _save(fn, button) {
    button.disabled = true;
    try {
      await fn();
    } catch (err) {
      button.disabled = false;
      window.alert(err?.message || "Could not save the dashboard.");
    }
  }

  _row(r, ignored = false) {
    const admin = this._isAdmin;
    return `<div class="att-row">
      <button type="button" class="list-row" data-att-open="${escapeHtml(r.entity_id)}" title="Details">
        <span>${escapeHtml(r.name)}${r.area ? ` <span class="what">· ${escapeHtml(r.area)}</span>` : ""}</span>
        <span class="level${r.group === "battery" ? " low" : ""}">${escapeHtml(r.detail)}</span>
      </button>
      ${admin ? `<button type="button" class="head-btn" data-att-ignore="${escapeHtml(r.key)}" data-ignore="${ignored ? "0" : "1"}"
        title="${ignored ? "Show it on Needs Attention again" : "Leave it off Needs Attention for everyone"}">${ignored ? "Stop ignoring" : "Ignore"}</button>` : ""}
    </div>`;
  }

  update() {
    const body = this.shadowRoot.querySelector(".att-body");
    if (!body) return;
    const report = this._report();
    const groups = report.groups.map((g) => `
      <section class="att-group att-${g.id}">
        <div class="section-head"><h2><span aria-hidden="true">${g.icon}</span> ${escapeHtml(g.title)} (${g.items.length})</h2></div>
        <p class="hint">${escapeHtml(g.hint)}</p>
        <div class="list-rows">${g.items.map((r) => this._row(r)).join("")}</div>
      </section>`).join("");
    const ignored = report.ignored.length
      ? `<details class="att-ignored"><summary>Ignored (${report.ignored.length})</summary>
          <div class="list-rows">${report.ignored.map((r) => this._row(r, true)).join("")}</div></details>`
      : "";
    const html = `${groups || `<div class="empty"><p><strong>Nothing needs attention.</strong></p>
        <p>Every device is responding, nothing is orphaned or outside a room, and every battery is at ${report.threshold}% or more.</p></div>`}${ignored}`;
    if (html !== this._bodyHtml) {
      const open = body.querySelector(".att-ignored")?.open;
      this._bodyHtml = html;
      body.innerHTML = html;
      if (open) body.querySelector(".att-ignored")?.setAttribute("open", "");
    }
    const count = this.shadowRoot.querySelector(".readings-inline");
    const text = report.count ? `${report.count} need${report.count === 1 ? "s" : ""} attention` : "All good";
    if (count && count.textContent !== text) count.textContent = text;
  }

  styles() {
    return `
      .att-level { gap: 10px; }
      .att-label { font-weight: 600; font-size: 0.9rem; }
      .stepper { display: inline-flex; align-items: center; gap: 6px; padding: 3px; border-radius: 10px; background: var(--cz-bg-secondary); }
      .stepper .step {
        width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--cz-border); background: var(--cz-card-bg);
        color: var(--cz-text); font: inherit; font-size: 1rem; font-weight: 700; cursor: pointer;
      }
      .stepper .step:disabled { opacity: 0.4; cursor: default; }
      .step-value { min-width: 3rem; text-align: center; }
      .att-group { max-width: 760px; }
      .att-group .hint { margin: -4px 0 8px; }
      .att-row { display: flex; align-items: center; gap: 8px; }
      .att-row .list-row { flex: 1; min-width: 0; }
      .att-offline .list-row { border-left: 4px solid #dc2626; }
      .att-battery .list-row { border-left: 4px solid #f59e0b; }
      .att-orphaned .list-row { border-left: 4px solid #6b7280; }
      .att-unassigned .list-row { border-left: 4px solid #3b82f6; }
      .att-offline .level { color: #b91c1c; }
      .att-ignored { max-width: 760px; margin-top: 8px; }
      .att-ignored summary { cursor: pointer; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--cz-text-secondary); margin-bottom: 8px; }
      .att-ignored .list-row { opacity: 0.7; }
      @media (max-width: 560px) {
        .att-row .list-row { flex-wrap: wrap; row-gap: 2px; }
        .att-row .level { margin-left: 0; flex-basis: 100%; font-size: 0.85rem; }
      }
    `;
  }
}
