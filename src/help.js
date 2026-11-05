import { escapeHtml } from "./base.js";
import { HELP_SECTIONS, WHATS_NEW, helpLinks, readmeUrl, screenshotUrl } from "./help-content.js";
import { sheetFrame } from "./sheet.js";
import { VERSION } from "./version.js";

const link = (url, label, cls = "") =>
  `<a class="${cls}" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;

/**
 * Help sheet (View → Help): what's new, one collapsible section per feature with a screenshot,
 * and links to the guide, release notes and issues. Static, so it is never re-rendered under the
 * user and opened sections stay open.
 */
class HelpSheet {
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

  _section(s) {
    const image = screenshotUrl(VERSION, s.image);
    return `<details class="help-sec" data-help-id="${s.id}">
      <summary>${escapeHtml(s.title)}</summary>
      <div class="help-body">
        <p>${escapeHtml(s.text)}</p>
        ${s.steps?.length ? `<ul class="lines">${s.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ul>` : ""}
        <a class="help-shot" href="${escapeHtml(image)}" target="_blank" rel="noopener noreferrer" title="Open full size">
          <img src="${escapeHtml(image)}" alt="Screenshot: ${escapeHtml(s.title)} (needs an internet connection)" loading="lazy" decoding="async" /></a>
        ${link(readmeUrl(VERSION, s.anchor), "More in the guide ›", "help-more")}
      </div>
    </details>`;
  }

  sheetBody() {
    const whatsNew = WHATS_NEW.version === VERSION || VERSION === "dev"
      ? `<div class="sheet-section help-new">
          <div class="section-label">What's new in ${escapeHtml(WHATS_NEW.version)}</div>
          <ul class="lines">${WHATS_NEW.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </div>`
      : "";
    const body = `
      ${whatsNew}
      <div class="sheet-section">
        <div class="section-label">Topics</div>
        <div class="help-toc">${HELP_SECTIONS.map((s) =>
          `<button type="button" class="help-chip" data-action="help-go" data-id="${s.id}">${escapeHtml(s.title)}</button>`).join("")}</div>
        <div class="help-list">${HELP_SECTIONS.map((s) => this._section(s)).join("")}</div>
      </div>
      <div class="sheet-section">
        <div class="section-label">Links</div>
        <div class="help-links">${helpLinks(VERSION).map((l) => link(l.url, l.label)).join("")}</div>
      </div>`;
    return sheetFrame({
      title: "ControlZ HA help",
      subtitle: `Version ${VERSION}`,
      body,
      wide: true,
      footer: `<button type="button" class="btn" data-action="sheet-close">Done</button>`,
    });
  }

  get actions() {
    return {
      "help-go": (button) => {
        const root = button.getRootNode();
        const section = root.querySelector(`details[data-help-id="${button.dataset.id}"]`);
        if (!section) return;
        for (const other of root.querySelectorAll("details.help-sec")) other.open = other === section;
        section.scrollIntoView({ block: "start", behavior: "smooth" });
      },
    };
  }
}

/** Open the help sheet; `host` keeps the sheet element (`_sheet`). */
export function openHelpSheet(host) {
  host._sheet ||= document.createElement("controlz-sheet");
  host._sheet.show(new HelpSheet(host));
}
