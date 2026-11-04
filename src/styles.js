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

  /* Room readings (ControlZ room sensor banner): temperature · humidity under the room name. */
  .readings { font-size: 0.78rem; font-weight: 600; color: var(--cz-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  .tile.on .readings { color: inherit; opacity: 0.8; }

  /* Thermostat: orange while heating, blue while cooling; +/− setpoint row. */
  .tile.heat { background: linear-gradient(135deg, #ffedd5 0%, #fdba74 100%); border-color: #fb923c; color: #431407; }
  .tile.cool { background: linear-gradient(135deg, #e0f2fe 0%, #7dd3fc 100%); border-color: #38bdf8; color: #082f49; }
  .tile.heat .badge, .tile.cool .badge { background: rgba(255,255,255,0.65); color: inherit; font-weight: 700; }
  .tile.heat .info, .tile.cool .info { color: inherit; opacity: 0.85; }
  .tile.heat .big-value, .tile.cool .big-value { color: inherit; }
  .temps { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
  .temps .info { white-space: nowrap; }
  .step-btn {
    appearance: none; width: 32px; min-width: 32px; height: 32px; padding: 0; border-radius: 8px; cursor: pointer;
    border: 1px solid var(--cz-border); background: #111827; color: #fff; font: inherit; font-size: 1.05rem; font-weight: 700; line-height: 1;
  }
  .step-btn:disabled { opacity: 0.4; cursor: default; }
  :host([size="thin"]) .step-btn { width: 30px; min-width: 30px; height: 30px; }
  :host([size="compact"]) .step-btn { width: 26px; min-width: 26px; height: 26px; font-size: 0.9rem; }
  .setpoint { flex: 1; min-width: 0; text-align: center; font-weight: 700; font-size: 0.95rem; white-space: nowrap; }
  :host([size="compact"]) .setpoint { font-size: 0.8rem; }
  .setpoint.pending { opacity: 0.6; }

  /* Fan: teal when on, so it never reads as a lit light. */
  .tile.fan-on { background: linear-gradient(135deg, #ccfbf1 0%, #5eead4 100%); border-color: #2dd4bf; color: #042f2e; }
  .tile.fan-on .badge { background: rgba(255,255,255,0.65); color: inherit; font-weight: 700; }
  .range-row.speed .range-icon { color: #0d9488; }
  .cz-range.range-speed { --fill: #14b8a6; }
  .tile.fan-on .range-row.speed .range-icon { color: #134e4a; }
  .tile.fan-on .cz-range { --rest: rgba(4,47,46,0.2); }

  /* Camera: snapshot fills the tile; name and state sit on a dark gradient. */
  .tile.camera { padding: 0; background: #0f172a; color: #fff; border-color: #1e293b; }
  .tile.camera .snap { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
  .tile.camera .no-snap { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 2rem; opacity: 0.5; }
  .tile.camera .header {
    position: relative; z-index: 1; padding: var(--tile-pad);
    background: linear-gradient(180deg, rgba(15,23,42,0.85) 0%, rgba(15,23,42,0) 100%);
  }
  .tile.camera .icon { background: rgba(255,255,255,0.15); border-color: rgba(255,255,255,0.25); }
  .tile.camera .badge { background: rgba(15,23,42,0.6); color: #fff; }
  .tile.camera .badge.live { background: #dc2626; }

  /* Automation tile extras: "What this will do" (Large), edit / delete icon buttons. */
  .what-btn {
    appearance: none; border: none; background: none; padding: 0; margin: 0; cursor: pointer; text-align: left;
    font: inherit; font-size: 0.75rem; font-weight: 600; color: var(--cz-primary);
  }
  .tile.scene.disabled .scene-icon { filter: grayscale(1); opacity: 0.6; }
  .tile.scene.disabled .name { opacity: 0.7; }
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
  /* Fits any window: capped height with its own scroll; a bottom sheet on phones. */
  .sheet {
    width: min(360px, 100%); background: var(--cz-card-bg); color: var(--cz-text);
    border-radius: 18px; padding: 16px; box-shadow: 0 20px 50px rgba(0,0,0,0.3);
    display: flex; flex-direction: column; gap: 12px; cursor: default;
    max-height: min(640px, calc(100vh - 32px)); max-height: min(640px, calc(100dvh - 32px));
    overflow: hidden;
  }
  .sheet-head { display: flex; align-items: flex-start; gap: 8px; flex-shrink: 0; }
  .sheet-titles { flex: 1; min-width: 0; }
  .sheet h3 { margin: 0; font-size: 1.05rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sheet-sub { font-size: 0.78rem; color: var(--cz-text-secondary); margin-top: 2px; }
  .sheet-x {
    width: 32px; height: 32px; border-radius: 50%; border: none; background: var(--cz-bg-secondary);
    color: var(--cz-text); font-size: 0.9rem; cursor: pointer; flex-shrink: 0;
  }
  .sheet-body { display: flex; flex-direction: column; gap: 12px; overflow-y: auto; min-height: 0; overscroll-behavior: contain; }
  .sheet-foot { display: flex; justify-content: flex-end; gap: 8px; flex-shrink: 0; }
  .sheet-foot .btn { flex: 0 0 auto; min-width: 88px; }
  .btn.ghost { background: transparent; color: var(--cz-text); border-color: var(--cz-border); }
  .sheet-section { display: flex; flex-direction: column; gap: 10px; }
  .sheet-section + .sheet-section { padding-top: 12px; border-top: 1px solid var(--cz-border); }
  @media (max-width: 520px) {
    .sheet-backdrop { align-items: flex-end; padding: 0; }
    .sheet {
      width: 100%; border-radius: 18px 18px 0 0;
      max-height: 85vh; max-height: 85dvh;
      padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
    }
  }
  @media (max-height: 520px) {
    .sheet { gap: 8px; padding: 12px; }
    .sheet-body, .sheet-section { gap: 8px; }
    .swatch { width: 28px; height: 28px; }
  }
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
  .sec-row {
    display: flex; align-items: center; gap: 10px; width: 100%; text-align: left;
    padding: 8px 10px; border-radius: 10px; border: 1px solid var(--cz-border);
    background: var(--cz-bg-secondary); color: var(--cz-text); font: inherit; cursor: pointer;
  }
  .sec-row .dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .sec-row .what { margin-left: auto; font-size: 0.8rem; color: var(--cz-text-secondary); }
  .sec-empty { color: var(--cz-text-secondary); font-size: 0.9rem; }
  .sec-scope { font-size: 0.75rem; color: var(--cz-text-secondary); }

  .sheet-fav {
    width: 32px; height: 32px; border-radius: 50%; border: none; background: var(--cz-bg-secondary);
    color: var(--cz-text-secondary); cursor: pointer; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
  }
  .sheet-fav svg { width: 18px; height: 18px; }
  .sheet-fav[aria-pressed="true"] { color: #e11d48; }
  .sheet .btn.secondary { background: var(--cz-bg-secondary); color: var(--cz-text); }
  .sheet .btn[aria-pressed="true"], .sheet .btn.secondary[aria-pressed="true"] { background: var(--cz-primary); border-color: var(--cz-primary); color: #fff; }
  .sheet .btn.danger { background: #b91c1c; border-color: #b91c1c; }
  .btn-wrap { display: flex; flex-wrap: wrap; gap: 6px; }
  .btn-wrap .btn { flex: 1 1 auto; min-width: 72px; }
  .sheet .note { margin: 0; font-size: 0.8rem; color: var(--cz-text-secondary); }
  .sheet .error { margin: 0; font-size: 0.82rem; font-weight: 600; color: #b91c1c; }
  .sheet ul.lines { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 3px; font-size: 0.88rem; }
  .sheet .lines-label { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: var(--cz-text-secondary); margin-top: 2px; }
  .sheet .big-row { display: flex; align-items: center; gap: 10px; }
  .sheet .big-row .setpoint { font-size: 1.5rem; }
  .sheet .step-btn { width: 40px; min-width: 40px; height: 40px; }

  /* Alarm keypad. */
  .code-dots { text-align: center; font-size: 1.4rem; letter-spacing: 0.3em; min-height: 1.8rem; font-weight: 700; }
  .keypad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .keypad .btn { min-height: 44px; font-size: 1.1rem; }
  .code-input, .field input, .field select {
    width: 100%; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--cz-border);
    background: var(--cz-card-bg); color: var(--cz-text); font: inherit; font-size: 0.92rem;
  }

  /* Automation editor form. */
  .field { display: flex; flex-direction: column; gap: 4px; }
  .field > span { font-size: 0.75rem; font-weight: 600; color: var(--cz-text-secondary); }
  .field-row { display: flex; gap: 8px; }
  .field-row > .field { flex: 1; min-width: 0; }
  .code-view {
    width: 100%; box-sizing: border-box; min-height: 160px; resize: vertical; padding: 8px 10px; border-radius: 8px;
    border: 1px solid var(--cz-border); background: var(--cz-bg-secondary); color: var(--cz-text);
    font: 0.78rem/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: pre; overflow: auto; tab-size: 2;
  }
  .file-btn { position: relative; overflow: hidden; text-align: center; cursor: pointer; }
  .file-btn input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
  .ed-step { display: flex; flex-direction: column; gap: 8px; }
  .ed-step.boxed { padding: 10px; border: 1px solid var(--cz-border); border-radius: 10px; }
  .ed-step-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 0.8rem; font-weight: 700; color: var(--cz-text-secondary); }
  .ed-step-head .btn { flex: 0 0 auto; padding: 4px 10px; font-size: 0.78rem; }

  .sec-row .level { margin-left: auto; font-weight: 700; font-size: 0.85rem; }
  .sec-row .level.low { color: #b91c1c; }
`;

export const GRID_STYLES = `
  ${TOKENS}
  .page { padding: 16px; max-width: 1600px; margin: 0 auto; --cz-scale: 1; }
  /* Tile scale: everything below the header zooms together (same look, controls still fit).
     --cz-inner is the measured content width in px, widened by 1 / scale so the zoomed
     content still spans the page (percentages are not used: browsers resolve them differently under zoom). */
  .page.scaled > :not(.page-head):not(.sheet-host):not(.edit-banner) {
    zoom: var(--cz-scale);
    width: calc(var(--cz-inner) / var(--cz-scale));
  }
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

  /* Edit rooms & favorites mode. Buttons keep their on-screen size at any tile scale. */
  .edit-banner {
    display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 16px;
    padding: 10px 14px; border-radius: 12px; background: rgba(79,70,229,0.12);
    border: 1px solid rgba(79,70,229,0.35); color: var(--cz-text); font-size: 0.9rem;
  }
  .edit-banner > span:first-child { flex: 1; min-width: 200px; }
  .edit-error { color: #b91c1c; font-weight: 600; }
  .eye-inline svg { width: 16px; height: 16px; vertical-align: -3px; }
  .tile-wrap { position: relative; min-width: 0; }
  .grid:has(.tile-wrap) { padding: 10px 10px 0 0; }
  .tile-wrap > :first-child { pointer-events: none; }
  .tile-wrap.is-hidden > :first-child { opacity: 0.35; filter: grayscale(0.7); }
  .hide-toggle {
    position: absolute; z-index: 2;
    top: calc(-10px / var(--cz-scale, 1)); right: calc(-10px / var(--cz-scale, 1));
    width: calc(34px / var(--cz-scale, 1)); height: calc(34px / var(--cz-scale, 1));
    border-radius: 50%; border: 2px solid #fff; background: rgba(17,24,39,0.88); color: #fff;
    display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  }
  .hide-toggle svg { width: 60%; height: 60%; }
  .hide-toggle[aria-pressed="true"] { background: #6b7280; }
  .hide-toggle:disabled, .fav-toggle:disabled, .move-btn:disabled { opacity: 0.5; cursor: wait; }
  .grid:has(.tile-wrap) { padding-left: 10px; column-gap: calc(var(--tile-gap) + 24px); row-gap: calc(var(--tile-gap) + 16px); }
  .fav-toggle, .move-btn {
    position: absolute; z-index: 2;
    width: calc(34px / var(--cz-scale, 1)); height: calc(34px / var(--cz-scale, 1));
    border-radius: 50%; border: 2px solid #fff; background: rgba(17,24,39,0.88); color: #fff;
    display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3); padding: 0;
  }
  .fav-toggle { top: calc(-10px / var(--cz-scale, 1)); left: calc(-10px / var(--cz-scale, 1)); }
  .fav-toggle[aria-pressed="true"] { background: #e11d48; }
  .fav-toggle svg, .move-btn svg { width: 55%; height: 55%; }
  .move-btn { bottom: calc(-6px / var(--cz-scale, 1)); }
  .move-btn.prev { left: calc(-10px / var(--cz-scale, 1)); }
  .move-btn.next { right: calc(-10px / var(--cz-scale, 1)); }
  .grid:has(.move-btn) { padding-bottom: 10px; }
  .tile-wrap[draggable="true"] { cursor: grab; }
  .tile-wrap.drag-over { outline: 3px dashed var(--cz-primary); outline-offset: 4px; border-radius: var(--cz-radius); }
  .tile-wrap.dragging { opacity: 0.4; }

  /* All Rooms filter row: All / On / Off, maintenance chip, All lights off. */
  .filter-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: -4px 0 16px; }
  .seg { display: inline-flex; gap: 3px; padding: 3px; border-radius: 10px; background: var(--cz-bg-secondary); }
  .seg button {
    border: none; background: transparent; color: var(--cz-text); padding: 6px 12px; border-radius: 8px;
    font: inherit; font-size: 0.82rem; font-weight: 600; cursor: pointer;
  }
  .seg button[aria-pressed="true"] { background: var(--cz-primary); color: #fff; }
  .pill {
    display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; min-height: 34px; border-radius: 999px;
    border: 1px solid var(--cz-border); background: var(--cz-card-bg); color: var(--cz-text);
    font: inherit; font-size: 0.82rem; font-weight: 600; cursor: pointer;
  }
  .pill.warn { border-color: #fdba74; background: #fff7ed; color: #9a3412; }
  .filter-row .spacer { flex: 1; }
  .section-head { display: flex; align-items: center; gap: 10px; margin: 0 0 10px; }
  .section-head h2 { margin: 0; flex: 1; }
  .head-btn {
    border: 1px solid var(--cz-border); background: var(--cz-card-bg); color: var(--cz-primary);
    border-radius: 8px; padding: 4px 10px; font: inherit; font-size: 0.78rem; font-weight: 700; cursor: pointer;
    white-space: nowrap; flex-shrink: 0;
  }
  .page-head .section-head { flex-wrap: wrap; row-gap: 6px; }
  .readings-inline { font-size: 0.9rem; font-weight: 600; color: var(--cz-text-secondary); white-space: nowrap; }
  .empty p { margin: 6px 0; }
`;
