/**
 * ControlZ tile contract (from ControlZ `Targets/ControlZ/HTML/_preview_*_tiles.html`):
 * Large 200×≥280 · Thin 100×≥280 · Compact 150×≥140 — fixed heights, do not grow.
 * Colours fall back to ControlZ values when the Home Assistant theme does not define them.
 */
export const TOKENS = `
  :host {
    display: block;
    --cz-card-bg: var(--ha-card-background, var(--card-background-color, #fff));
    --cz-bg-secondary: var(--secondary-background-color, #f3f4f6);
    --cz-border: var(--divider-color, #e5e7eb);
    --cz-text: var(--primary-text-color, #111827);
    --cz-text-secondary: var(--secondary-text-color, #6b7280);
    --cz-primary: #4f46e5;
    --cz-radius: 16px;
    --cz-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
    --tile-on-text: #3f2a00;
    --tile-h: 200px;
    --tile-pad: 12px;
    --tile-gap: 12px;
    --tile-col-min: 280px;
    font-family: var(--ha-font-family-body, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
    color: var(--cz-text);
  }
  :host([size="thin"]) { --tile-h: 100px; --tile-pad: 8px 12px; --tile-gap: 6px; }
  :host([size="compact"]) { --tile-h: 150px; --tile-pad: 8px; --tile-gap: 8px; --tile-col-min: 140px; }
  * { box-sizing: border-box; }
`;

export const TILE_STYLES = `
  ${TOKENS}
  .tile {
    position: relative;
    border-radius: var(--cz-radius);
    padding: var(--tile-pad);
    background: var(--cz-card-bg);
    border: 1px solid var(--cz-border);
    box-shadow: var(--cz-shadow);
    display: flex; flex-direction: column; gap: 6px;
    min-width: 0;
    height: var(--tile-h); min-height: var(--tile-h); max-height: var(--tile-h);
    overflow: hidden;
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  :host([size="thin"]) .tile { gap: 4px; }
  .tile.on {
    background: linear-gradient(135deg, rgba(255,220,100,1) 0%, rgba(255,200,80,0.95) 100%);
    color: var(--tile-on-text);
    border-color: rgba(0,0,0,0.06);
  }
  .tile.on.follows { background: var(--follow-bg); }
  .tile.offline { opacity: 0.55; }
  .tile.insecure { background: linear-gradient(135deg, #fff1f2 0%, #fecdd3 100%); border-color: #fda4af; color: #111827; }
  .tile.insecure .icon { color: #b91c1c; }
  .tile.motion-active {
    background: linear-gradient(135deg, rgba(254,202,202,0.98) 0%, rgba(248,113,113,0.92) 55%, rgba(220,38,38,0.88) 100%);
    box-shadow: 0 3px 10px rgba(220,38,38,0.35);
    color: #450a0a; border-color: #f87171;
  }
  .tile.motion-active .icon { color: #b91c1c; }

  .header { display: flex; align-items: flex-start; gap: 8px; min-width: 0; }
  .icon {
    width: 32px; height: 32px; border-radius: 50%;
    background: rgba(255,255,255,0.35); border: 1px solid var(--cz-border);
    display: inline-flex; align-items: center; justify-content: center;
    flex-shrink: 0; font-size: 16px; line-height: 1;
  }
  .icon svg { width: 18px; height: 18px; display: block; }
  .icon ha-icon { --mdc-icon-size: 18px; display: flex; }
  :host([size="compact"]) .icon ha-icon { --mdc-icon-size: 13px; }
  :host([size="thin"]) .icon { width: 28px; height: 28px; font-size: 14px; }
  :host([size="compact"]) .icon { width: 22px; height: 22px; font-size: 12px; }
  :host([size="compact"]) .icon svg { width: 13px; height: 13px; }
  .name-block { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
  .name {
    font-weight: 600; line-height: 1.25; width: 100%;
    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2;
    overflow: hidden; overflow-wrap: break-word;
  }
  :host([size="thin"]) .name {
    display: block; white-space: nowrap; text-overflow: ellipsis; font-size: 0.85rem; line-height: 1.2;
  }
  :host([size="compact"]) .name { font-size: 11px; line-height: 1.2; }

  .badge {
    padding: 3px 7px; border-radius: 6px; font-size: 10px; font-weight: 600;
    background: rgba(158,158,158,0.2); color: var(--cz-text-secondary); text-transform: uppercase;
    white-space: nowrap; flex-shrink: 0;
  }
  .tile.on .badge { background: rgba(255,255,255,0.65); color: var(--tile-on-text); font-weight: 700; }
  .badge.secure { background: rgba(34,197,94,0.2); color: #166534; }
  .badge.warn { background: rgba(239,68,68,0.18); color: #b91c1c; }
  .tile.motion-active .badge { background: rgba(255,255,255,0.65); color: #450a0a; font-weight: 700; }
  :host([size="thin"]) .badge { font-size: 9px; padding: 2px 6px; }
  :host([size="compact"]) .badge { font-size: 9px; padding: 2px 5px; }

  .chips { display: inline-flex; gap: 4px; flex-shrink: 0; align-items: center; }
  .chip {
    display: inline-flex; align-items: center; gap: 3px;
    padding: 2px 7px; border-radius: 999px; font-size: 11px; font-weight: 700; color: #fff;
  }
  .chip svg { width: 12px; height: 12px; }
  .chip.green { background: #22c55e; }
  .chip.orange { background: #f97316; }
  .chip.blue { background: #3b82f6; }
  :host([size="compact"]) .chip { padding: 1px 5px; font-size: 10px; }

  .controls, .bottom { margin-top: auto; width: 100%; min-width: 0; flex-shrink: 0; }
  .row { display: flex; align-items: center; gap: 8px; margin: 0 0 4px; width: 100%; min-width: 0; }
  .row:last-child { margin-bottom: 0; }
  .row.osc { gap: 6px; }
  :host([size="compact"]) .row.osc { gap: 3px; }
  .divider { height: 1px; background: rgba(0,0,0,0.1); margin: 4px 0 6px; }
  .chips.under { flex-wrap: wrap; }

  .btn {
    appearance: none; border: 1px solid var(--cz-border); background: #111827; color: #fff;
    font: inherit; font-weight: 700; font-size: 0.7rem; min-height: 32px; padding: 0.25rem 0.5rem;
    border-radius: 8px; cursor: pointer; flex: 1 1 0; min-width: 0;
  }
  .btn:active { filter: brightness(1.25); }
  :host([size="thin"]) .btn { min-height: 30px; font-size: 0.68rem; padding: 0.2rem 0.35rem; }
  :host([size="compact"]) .btn { min-height: 26px; padding: 0.15rem 0.2rem; font-size: 0.6rem; }

  .toggle { position: relative; display: inline-block; width: 40px; height: 22px; flex-shrink: 0; }
  .toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
  .toggle .slider { position: absolute; inset: 0; background: #9ca3af; border-radius: 999px; cursor: pointer; }
  .toggle .slider::before {
    content: ""; position: absolute; width: 16px; height: 16px; left: 3px; top: 3px;
    background: #fff; border-radius: 50%; transition: transform 0.15s;
  }
  .toggle input:checked + .slider { background: #22c55e; }
  .toggle input:checked + .slider::before { transform: translateX(18px); }
  .toggle input:focus-visible + .slider { outline: 2px solid var(--cz-primary); outline-offset: 2px; }
  :host([size="thin"]) .toggle { width: 36px; height: 20px; }
  :host([size="thin"]) .toggle .slider::before { width: 14px; height: 14px; }
  :host([size="thin"]) .toggle input:checked + .slider::before { transform: translateX(16px); }

  .color-btn {
    width: 28px; min-width: 28px; height: 28px; padding: 0;
    display: inline-flex; align-items: center; justify-content: center;
    border: 1px solid rgba(17,24,39,0.35); background: rgba(17,24,39,0.88); color: #fff;
    border-radius: 8px; cursor: pointer; flex-shrink: 0; margin-left: auto;
  }
  .color-btn svg { width: 15px; height: 15px; display: block; }
  .tile.on .color-btn { background: rgba(0,0,0,0.42); border-color: rgba(0,0,0,0.25); }

  /* Brightness and covering position must never look alike: own icon + own fill colour. */
  .range-row { gap: 6px; }
  .range-icon { width: 16px; height: 16px; flex-shrink: 0; display: inline-flex; }
  .range-icon svg { width: 16px; height: 16px; }
  .range-row.brightness .range-icon { color: #d97706; }
  .range-row.position .range-icon { color: #2563eb; }
  .tile.on .range-row.brightness .range-icon { color: #fff; filter: drop-shadow(0 0 1px rgba(63,42,0,0.8)); }
  .cz-range {
    --fill: #f59e0b; --rest: rgba(127,127,127,0.28);
    -webkit-appearance: none; appearance: none; background: transparent;
    flex: 1; min-width: 0; height: 20px; margin: 0; cursor: pointer;
  }
  .cz-range.range-position { --fill: #3b82f6; }
  .tile.on .cz-range { --rest: rgba(63,42,0,0.22); }
  .tile.on .cz-range.range-brightness { --fill: #ffffff; }
  .cz-range::-webkit-slider-runnable-track {
    height: 6px; border-radius: 999px;
    background: linear-gradient(90deg, var(--fill) 0 var(--pct, 50%), var(--rest) var(--pct, 50%) 100%);
  }
  .cz-range::-moz-range-track { height: 6px; border-radius: 999px; background: var(--rest); }
  .cz-range::-moz-range-progress { height: 6px; border-radius: 999px; background: var(--fill); }
  .cz-range::-webkit-slider-thumb {
    -webkit-appearance: none; appearance: none; width: 16px; height: 16px; margin-top: -5px;
    border-radius: 50%; background: #fff; border: 2px solid var(--fill); box-shadow: 0 1px 3px rgba(0,0,0,0.35);
  }
  .cz-range::-moz-range-thumb {
    width: 12px; height: 12px; border-radius: 50%; background: #fff;
    border: 2px solid var(--fill); box-shadow: 0 1px 3px rgba(0,0,0,0.35);
  }
  .tile.on .cz-range.range-brightness::-webkit-slider-thumb { border-color: #92400e; }
  .tile.on .cz-range.range-brightness::-moz-range-thumb { border-color: #92400e; }
  .cz-range:focus-visible { outline: 2px solid var(--cz-primary); outline-offset: 2px; border-radius: 999px; }
  .cz-range:disabled { opacity: 0.5; cursor: default; }
  .value { font-size: 11px; font-weight: 600; min-width: 2.25rem; text-align: right; flex-shrink: 0; }

  .info { font-size: 0.85em; color: var(--cz-text-secondary); }
  .tile.on .info, .tile.motion-active .info, .tile.insecure .info { color: inherit; opacity: 0.85; }
  .big-value { font-size: 1.5rem; font-weight: 700; line-height: 1.1; color: var(--cz-text); }
  :host([size="compact"]) .big-value { font-size: 1.1rem; }
  .ago { font-size: 0.72em; font-weight: 600; margin-top: 0.15em; }
  .ago.fresh { font-weight: 800; }

  .trail { display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; }
  :host([size="thin"]) .hide-thin { display: none !important; }
  :host([size="compact"]) .hide-compact { display: none !important; }
  :host(:not([size="large"])) .large-only { display: none !important; }
`;

export const SCENE_STYLES = `
  .tile.scene { cursor: default; gap: 8px; }
  :host([size="thin"]) .tile.scene { gap: 4px; }
  :host([size="compact"]) .tile.scene { gap: 4px; }
  .tile.scene.active { border-color: #22c55e; box-shadow: 0 0 0 1px #22c55e inset, var(--cz-shadow); }
  .scene-icon { background: var(--cz-bg-secondary); }
  .meta { margin: 0; font-size: 0.8em; color: var(--cz-text-secondary); line-height: 1.35; }
  :host([size="compact"]) .meta, :host([size="thin"]) .meta { display: none; }
  .footer {
    display: flex; align-items: center; gap: 6px; margin-top: auto;
    padding-top: 10px; border-top: 1px solid var(--cz-border);
  }
  :host([size="compact"]) .footer, :host([size="thin"]) .footer { padding-top: 6px; gap: 4px; }
  :host([size="thin"]) .run-btn { padding: 4px 10px; }
  :host([size="thin"]) .icon-btn { width: 1.75rem; height: 1.75rem; }
  .run-btn {
    flex: 1 1 auto; min-width: 3.5rem; padding: 6px 12px; border-radius: 8px;
    border: 1px solid #22c55e; background: #22c55e; color: #fff; cursor: pointer;
    font: inherit; font-size: 0.85em; font-weight: 600;
  }
  .run-btn:active { filter: brightness(1.1); }
  :host([size="compact"]) .run-btn { padding: 5px 8px; font-size: 11px; }
  .icon-btn {
    width: 2rem; height: 2rem; padding: 0; border-radius: 8px;
    border: 1px solid var(--cz-border); background: var(--cz-card-bg); color: var(--cz-primary);
    cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
    font-size: 0.95rem; flex-shrink: 0;
  }
  .icon-btn.is-off { color: #6b7280; background: var(--cz-bg-secondary); }
`;

export const SHEET_STYLES = `
  .sheet-backdrop {
    position: fixed; inset: 0; background: rgba(15,23,42,0.45); z-index: 10;
    display: flex; align-items: center; justify-content: center; padding: 16px;
  }
  .sheet {
    width: min(360px, 100%); background: var(--cz-card-bg); color: var(--cz-text);
    border-radius: 18px; padding: 16px; box-shadow: 0 20px 50px rgba(0,0,0,0.3);
    display: flex; flex-direction: column; gap: 12px; cursor: default;
    max-height: calc(100vh - 32px); overflow-y: auto;
  }
  .sheet-section { display: flex; flex-direction: column; gap: 10px; }
  .sheet-section + .sheet-section { padding-top: 12px; border-top: 1px solid var(--cz-border); }
  .sheet h3 { margin: 0; font-size: 1.05rem; }
  .sheet .section-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: var(--cz-text-secondary); letter-spacing: 0.04em; }
  .sheet .row { margin: 0; }
  .swatches { display: flex; flex-wrap: wrap; gap: 8px; }
  .swatch {
    width: 32px; height: 32px; border-radius: 8px; border: 2px solid rgba(255,255,255,0.9);
    box-shadow: 0 0 0 1px var(--cz-border); cursor: pointer; padding: 0;
  }
  .ct-row { display: flex; gap: 6px; }
  .ct-btn {
    flex: 1; padding: 8px 6px; border-radius: 8px; border: 1px solid var(--cz-border);
    font: inherit; font-size: 0.75rem; font-weight: 700; cursor: pointer; color: #1f2937;
  }
  .sheet .close { align-self: flex-end; }
`;

export const GRID_STYLES = `
  ${TOKENS}
  .page { padding: 16px; max-width: 1600px; margin: 0 auto; }
  .page-title { margin: 0 0 12px; font-size: 1.35rem; font-weight: 700; display: flex; align-items: center; gap: 10px; }
  .title-icon { display: inline-flex; width: 28px; height: 28px; color: var(--cz-text-secondary); }
  .title-icon svg { width: 28px; height: 28px; }
  .title-icon ha-icon { --mdc-icon-size: 28px; }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(var(--tile-col-min), 100%), 1fr));
    gap: var(--tile-gap);
    align-items: start;
  }
  .master { margin-bottom: 20px; max-width: 640px; }
  section { margin-bottom: 22px; }
  h2 {
    margin: 0 0 10px; font-size: 0.8rem; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.04em; color: var(--cz-text-secondary);
  }
  .page-head { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
  .page-head > :first-child { flex: 1; min-width: 0; }
  .page-head .page-title { margin: 0; }
  .banner {
    display: flex; gap: 10px; align-items: center; width: 100%;
    padding: 10px 14px; border-radius: 12px; border: none; text-align: left;
    background: #bbf7d0; color: #14532d; font: inherit; font-weight: 600; cursor: pointer;
  }
  .banner-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .banner-more { margin-left: auto; font-size: 1.3rem; line-height: 1; opacity: 0.7; }
  .banner.motion { background: #fde68a; color: #78350f; }
  .banner.warning { background: #fed7aa; color: #7c2d12; }
  .banner.insecure { background: #fecaca; color: #7f1d1d; }
  .btn {
    appearance: none; border: 1px solid var(--cz-border); background: #111827; color: #fff;
    font: inherit; font-weight: 700; font-size: 0.8rem; min-height: 36px; padding: 0.3rem 1rem;
    border-radius: 8px; cursor: pointer;
  }
  .empty { color: var(--cz-text-secondary); padding: 24px; text-align: center; }
`;
