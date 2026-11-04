import { assignArea, roomOptionsHtml, waitForConfigEntity } from "./automation-editor.js";
import { newAutomationId } from "./automation-model.js";
import { escapeHtml } from "./base.js";
import { sheetFrame } from "./sheet.js";
import {
  FORMATS, MAX_IMPORT_CHARS, TRANSFER_KINDS, exportFileName, importConfig, mimeType, parseImport, serializeConfig,
} from "./transfer-model.js";

/** Scene / automation config API (admins only), the endpoints Home Assistant's own editors use. */
export const fetchConfig = (hass, kind, id) => hass.callApi("GET", `${TRANSFER_KINDS[kind].api}/${encodeURIComponent(id)}`);
export const saveConfig = (hass, kind, id, config) => hass.callApi("POST", `${TRANSFER_KINDS[kind].api}/${encodeURIComponent(id)}`, config);
export const editorPath = (kind, id) => `${TRANSFER_KINDS[kind].editor}/${encodeURIComponent(id)}`;

const errorText = (err, fallback) => err?.body?.message || err?.message || fallback;

function showSheet(host, owner) {
  host._sheet ||= document.createElement("controlz-sheet");
  host._sheet.show(owner);
}

/** Sheet owners that are not tiles: the host keeps pushing `hass`, so the sheet re-renders through it. */
class HostedSheet {
  constructor(host) {
    this._host = host;
  }

  get hass() {
    return this._host.hass;
  }

  moreInfo() {}

  sheetDetailsEntity() {
    return null;
  }

  _rerender() {
    this._host._sheet?.refresh(true);
  }
}

const shareFile = (text, name, format) => new File([text], name, { type: format === "json" ? "application/json" : "text/plain" });
const canShareFiles = () => {
  try {
    return !!navigator.canShare?.({ files: [shareFile("", "x.yaml", "yaml")] });
  } catch {
    return false;
  }
};

/** Export one scene or automation: view as YAML or JSON, copy, download or share the file. */
class ExportSheet extends HostedSheet {
  constructor(host, { kind, name, config }) {
    super(host);
    this._kind = kind;
    this._name = name;
    this._config = config;
    this._format = "yaml";
    this._status = "";
  }

  get _text() {
    return serializeConfig(this._config, this._format);
  }

  get _fileName() {
    return exportFileName(this._kind, this._name, this._format);
  }

  sheetBody() {
    const label = TRANSFER_KINDS[this._kind].label;
    const format = FORMATS.find((f) => f.id === this._format).label;
    const body = `
      <div class="sheet-section">
        <div class="btn-wrap" role="group" aria-label="Format">${FORMATS.map((f) =>
          `<button type="button" class="btn secondary" data-action="xp-format" data-format="${f.id}" aria-pressed="${f.id === this._format}">${f.label}</button>`).join("")}</div>
        <textarea class="code-view" data-export-text readonly rows="14" spellcheck="false" aria-label="${escapeHtml(`${label} as ${format}`)}">${escapeHtml(this._text)}</textarea>
        <div class="btn-wrap">
          <button type="button" class="btn secondary" data-action="xp-copy">Copy</button>
          <button type="button" class="btn secondary" data-action="xp-download">Download</button>
          ${canShareFiles() ? `<button type="button" class="btn secondary" data-action="xp-share">Share…</button>` : ""}
        </div>
        ${this._status ? `<p class="note" role="status">${escapeHtml(this._status)}</p>` : ""}
        <p class="note">Paste it into Home Assistant's YAML editor, or bring it into another Home Assistant with ControlZ Import.</p>
      </div>`;
    return sheetFrame({
      title: `Export ${this._name}`,
      subtitle: `${label} · ${this._fileName}`,
      body,
      footer: `<button type="button" class="btn" data-action="sheet-close">Done</button>`,
    });
  }

  _say(status) {
    this._status = status;
    this._rerender();
  }

  async _copy(button) {
    const text = this._text;
    try {
      await navigator.clipboard.writeText(text);
      this._say("Copied.");
      return;
    } catch {
      // Not a secure context (plain http on the LAN): fall back to selecting the text.
    }
    const select = (root) => {
      const area = root?.querySelector("[data-export-text]");
      area?.focus();
      area?.select();
    };
    select(button.getRootNode());
    const copied = document.execCommand?.("copy");
    this._say(copied ? "Copied." : "The text is selected; use your device's Copy.");
    if (!copied) select(this._host._sheet?.shadowRoot);
  }

  _download() {
    const url = URL.createObjectURL(new Blob([this._text], { type: mimeType(this._format) }));
    const link = document.createElement("a");
    link.href = url;
    link.download = this._fileName;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this._say(`Downloaded ${this._fileName}.`);
  }

  async _share() {
    try {
      await navigator.share({ files: [shareFile(this._text, this._fileName, this._format)], title: this._name });
    } catch (err) {
      if (err?.name !== "AbortError") this._say("Sharing did not work here; use Copy or Download.");
    }
  }

  get actions() {
    return {
      "xp-format": (button) => {
        this._format = button.dataset.format;
        this._status = "";
        this._rerender();
      },
      "xp-copy": (button) => this._copy(button),
      "xp-download": () => this._download(),
      "xp-share": () => this._share(),
    };
  }
}

/** Open the export sheet for a loaded config (`{ kind: "scene" | "automation", name, config }`). */
export function openExportSheet(host, opts) {
  showSheet(host, new ExportSheet(host, opts));
}

/** Import scenes and automations from pasted text or a file; each is added new, in the chosen room. */
class ImportSheet extends HostedSheet {
  constructor(host, { areaId = "" } = {}) {
    super(host);
    this._text = "";
    this._parsed = null;
    this._areaId = areaId;
    this._busy = "";
    this._error = null;
  }

  _parse() {
    this._parsed = parseImport(this._text);
    this._error = null;
  }

  _missing(item) {
    if (item.kind !== "scene") return [];
    return Object.keys(item.config.entities).filter((id) => !this.hass?.states?.[id]);
  }

  _preview() {
    const items = this._parsed?.items || [];
    if (!items.length) return "";
    const lines = items.map((item) => {
      const label = TRANSFER_KINDS[item.kind].label;
      const missing = this._missing(item);
      const extra = item.kind === "scene"
        ? `${Object.keys(item.config.entities).length} devices${missing.length ? ` (${missing.length} not in this Home Assistant)` : ""}`
        : "";
      return `<li>${escapeHtml(`${label}: ${item.name}${extra ? ` · ${extra}` : ""}`)}</li>`;
    }).join("");
    return `<div class="sheet-section">
      <div class="section-label">Will add</div>
      <ul class="lines">${lines}</ul>
      <label class="field"><span>Room</span>
        <select data-action="imp-area" aria-label="Room">${roomOptionsHtml(this.hass, this._host._config || {}, this._areaId, "No room")}</select></label>
    </div>`;
  }

  sheetBody() {
    const error = this._error || this._parsed?.error;
    const count = this._parsed?.items?.length || 0;
    const body = `
      <div class="sheet-section">
        <label class="field"><span>Paste YAML or JSON (one scene or automation, or a list)</span>
          <textarea class="code-view" data-action="imp-text" rows="10" spellcheck="false" autocapitalize="off"
            placeholder="name: Movie night&#10;entities:&#10;  light.lounge_lamp:&#10;    state: &quot;on&quot;">${escapeHtml(this._text)}</textarea></label>
        <label class="btn secondary file-btn">Choose file…
          <input type="file" data-action="imp-file" accept=".yaml,.yml,.json,application/json,application/yaml,text/yaml,text/plain" /></label>
      </div>
      ${this._preview()}
      ${error ? `<div class="sheet-section"><p class="error">${escapeHtml(error)}</p></div>` : ""}
      <p class="note">Imports are always added as new scenes and automations; nothing already in Home Assistant is replaced.</p>`;
    const footer = `
      <button type="button" class="btn ghost" data-action="sheet-close">Cancel</button>
      <button type="button" class="btn" data-action="imp-save" ${this._busy ? "disabled" : ""}>${this._busy || (count > 1 ? `Import ${count}` : "Import")}</button>`;
    return sheetFrame({ title: "Import scenes & automations", subtitle: "", body, footer });
  }

  async _loadFile(input) {
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMPORT_CHARS) {
      this._error = "That file is too large to import here.";
      this._rerender();
      return;
    }
    this._text = await file.text();
    this._parse();
    this._rerender();
  }

  async _save() {
    this._parse();
    const items = this._parsed.items;
    if (this._parsed.error || !items.length) {
      this._rerender();
      return;
    }
    const getHass = () => this._host.hass;
    const first = Date.now();
    let done = 0;
    try {
      for (const [i, item] of items.entries()) {
        this._busy = `Importing ${i + 1} of ${items.length}…`;
        this._rerender();
        const id = newAutomationId(first + i);
        await saveConfig(this.hass, item.kind, id, importConfig(item, id));
        done += 1;
        if (this._areaId) {
          const entityId = await waitForConfigEntity(getHass, TRANSFER_KINDS[item.kind].domain, id);
          if (entityId) await assignArea(getHass, entityId, this._areaId);
        }
      }
      this._host._sheet?.close();
    } catch (err) {
      this._busy = "";
      const reason = errorText(err, "Home Assistant did not accept it.");
      this._error = items.length > 1 ? `Imported ${done} of ${items.length}. ${reason}` : reason;
      if (done) this._text = serializeConfig(items.slice(done).map((item) => item.config), "yaml");
      this._parsed = done ? parseImport(this._text) : this._parsed;
      this._rerender();
    }
  }

  get actions() {
    return {
      "input:imp-text": (area) => {
        this._text = area.value;
      },
      "change:imp-text": (area) => {
        this._text = area.value;
        this._parse();
        this._rerender();
      },
      "change:imp-file": (input) => this._loadFile(input),
      "change:imp-area": (select) => {
        this._areaId = select.value;
      },
      "imp-save": () => this._save(),
    };
  }
}

/** Open the import sheet (admins); `areaId` preselects the room the new items go in. */
export function openImportSheet(host, opts = {}) {
  showSheet(host, new ImportSheet(host, opts));
}
