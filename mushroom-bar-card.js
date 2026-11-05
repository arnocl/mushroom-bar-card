/**
 * Mushroom Bar Card
 * A compact, Mushroom-style progress bar for numeric sensors and counters.
 * Severity colours drive both the icon and the bar. No dependencies.
 * https://github.com/arnocl/mushroom-bar-card
 *
 * type: custom:mushroom-bar-card
 * entity: counter.water_filter
 * name: Filter life           # optional (default: friendly_name)
 * icon: mdi:water-check       # optional (default: entity icon)
 * min: 0                      # default 0
 * max: 365                    # default 100
 * target: 180                 # optional, shows a target zone
 * unit: " d"                  # optional (default: entity unit)
 * decimals: 0                 # optional
 * color: blue                 # colour without severity (default: blue)
 * icon_background: false      # tinted circle behind the icon
 * severity:                   # optional; "from" thresholds, any order
 *   - { from: 0,   color: green }
 *   - { from: 180, color: orange }
 *   - { from: 240, color: red }
 * tap_action / hold_action / double_tap_action  (default tap: more-info)
 */

const VERSION = "1.0.0";

const NAMED = {
  green: "76,175,80",
  orange: "255,152,0",
  red: "244,67,54",
  blue: "68,115,158",
  yellow: "255,193,7",
  purple: "156,39,176",
  teal: "0,150,136",
  grey: "158,158,158",
  disabled: "200,200,200",
};

/** Converts "green" | "76,175,80" | "rgb(76,175,80)" | "#4caf50" | "var(--x)" into a CSS colour. */
function cssColor(c) {
  if (!c) return `rgb(${NAMED.blue})`;
  c = String(c).trim();
  if (NAMED[c]) return `rgb(${NAMED[c]})`;
  if (/^\d+\s*,\s*\d+\s*,\s*\d+$/.test(c)) return `rgb(${c})`;
  if (/^[a-z-]+$/i.test(c)) return `var(--${c}-color, ${c})`;
  return c;
}

class MushroomBarCard extends HTMLElement {
  static getStubConfig(hass) {
    const e = Object.keys(hass?.states || {}).find(
      (id) => id.startsWith("sensor.") && hass.states[id].attributes.unit_of_measurement === "%"
    );
    return { entity: e || "sensor.example", min: 0, max: 100 };
  }

  static getConfigForm() {
    return {
      schema: [
        { name: "entity", required: true, selector: { entity: {} } },
        {
          type: "grid",
          name: "",
          schema: [
            { name: "name", selector: { text: {} } },
            { name: "icon", selector: { icon: {} }, context: { icon_entity: "entity" } },
            { name: "min", selector: { number: { mode: "box" } } },
            { name: "max", selector: { number: { mode: "box" } } },
            { name: "target", selector: { number: { mode: "box" } } },
            { name: "unit", selector: { text: {} } },
            { name: "decimals", selector: { number: { min: 0, max: 4, mode: "box" } } },
            { name: "color", selector: { text: {} } },
          ],
        },
        { name: "icon_background", selector: { boolean: {} } },
        { name: "severity", selector: { object: {} } },
        { name: "tap_action", selector: { ui_action: {} } },
        { name: "hold_action", selector: { ui_action: {} } },
      ],
      computeLabel: (s) => ({
        entity: "Entity", name: "Name", icon: "Icon", min: "Minimum", max: "Maximum",
        target: "Target", unit: "Unit", decimals: "Decimals", color: "Colour (no severity)",
        icon_background: "Icon background", severity: "Severity (list of from + color)",
        tap_action: "Tap action", hold_action: "Hold action",
      }[s.name]),
    };
  }

  setConfig(config) {
    if (!config || !config.entity) throw new Error("mushroom-bar-card: 'entity' is required");
    // Copy the entries: config objects coming from the editor are frozen.
    const sev = (Array.isArray(config.severity) ? config.severity : [])
      .filter((s) => s && typeof s === "object")
      .map((s) => ({ ...s, from: s.from === undefined ? -Infinity : Number(s.from) }))
      .sort((a, b) => a.from - b.from);
    this._config = {
      min: 0,
      max: 100,
      color: "blue",
      icon_background: false,
      tap_action: { action: "more-info" },
      ...config,
      severity: sev,
    };
    this._lastKey = undefined;
    if (!this.shadowRoot) this._build();
    if (this._hass) this._render();
  }

  set hass(hass) {
    this._hass = hass;
    const s = hass.states[this._config?.entity];
    const key = s ? `${s.state}|${s.attributes.friendly_name}|${s.attributes.icon}|${hass.themes?.darkMode}` : "missing";
    if (key === this._lastKey) return;
    this._lastKey = key;
    this._render();
  }

  getCardSize() { return 1; }
  getGridOptions() { return { columns: 6, rows: 1, min_columns: 3, min_rows: 1 }; }
  getLayoutOptions() { return { grid_columns: 2, grid_rows: 1 }; }

  _build() {
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host { --mbc-color: rgb(${NAMED.blue}); display: block; height: 100%; }
        ha-card {
          height: 100%; box-sizing: border-box; padding: 10px;
          display: flex; align-items: center; cursor: pointer;
          transition: background-color 0.05s;
          -webkit-tap-highlight-color: transparent;
        }
        ha-card:hover { background-color: color-mix(in srgb, var(--mbc-color) 3%, var(--ha-card-background, var(--card-background-color))); }
        .container { display: flex; align-items: center; gap: 10px; width: 100%; min-width: 0; }
        .icon {
          flex: none; width: 36px; height: 36px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          color: var(--mbc-color);
          background-color: color-mix(in srgb, var(--mbc-color) var(--mbc-icon-bg, 0%), transparent);
          --mdc-icon-size: 24px;
        }
        .info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .name {
          font-size: 14px; font-weight: 500; line-height: 20px; letter-spacing: 0.1px;
          color: var(--primary-text-color);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .row { display: flex; align-items: center; gap: 8px; height: 16px; }
        .value {
          flex: none; font-size: 12px; font-weight: 400; line-height: 16px; letter-spacing: 0.4px;
          color: var(--secondary-text-color); white-space: nowrap;
        }
        .track {
          position: relative; flex: 1; height: var(--mbc-height, 8px); border-radius: 8px; overflow: hidden;
          background-color: color-mix(in srgb, var(--mbc-color) 20%, transparent);
        }
        .fill, .target { position: absolute; top: 0; bottom: 0; left: 0; border-radius: 8px; }
        .fill { background-color: var(--mbc-color); transition: width 0.6s ease; }
        .target { background-color: color-mix(in srgb, var(--mbc-color) 30%, transparent); display: none; }
        .unavailable .fill { width: 0 !important; }
      </style>
      <ha-card>
        <div class="container">
          <div class="icon"><ha-state-icon></ha-state-icon></div>
          <div class="info">
            <div class="name"></div>
            <div class="row"><span class="value"></span>
              <div class="track"><div class="target"></div><div class="fill"></div></div>
            </div>
          </div>
        </div>
      </ha-card>`;
    this._el = {
      card: root.querySelector("ha-card"),
      icon: root.querySelector("ha-state-icon"),
      name: root.querySelector(".name"),
      value: root.querySelector(".value"),
      fill: root.querySelector(".fill"),
      target: root.querySelector(".target"),
    };
    this._bindActions(this._el.card);
  }

  _colorFor(v) {
    const { severity, color } = this._config;
    if (!severity.length || isNaN(v)) return cssColor(color);
    let pick = severity[0];
    for (const s of severity) if (v >= Number(s.from)) pick = s;
    return cssColor(pick.color);
  }

  _pct(v) {
    const min = Number(this._config.min), max = Number(this._config.max);
    if (max === min) return 0;
    return Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100));
  }

  _formatValue(stateObj, v) {
    const c = this._config;
    if (c.unit === undefined && c.decimals === undefined && this._hass.formatEntityState) {
      return this._hass.formatEntityState(stateObj);
    }
    const unit = c.unit !== undefined ? c.unit : (stateObj.attributes.unit_of_measurement ? ` ${stateObj.attributes.unit_of_measurement}` : "");
    const lang = this._hass.locale?.language || this._hass.language || "en";
    const opts = c.decimals !== undefined ? { minimumFractionDigits: c.decimals, maximumFractionDigits: c.decimals } : { maximumFractionDigits: 1 };
    return `${v.toLocaleString(lang, opts)}${unit}`;
  }

  _render() {
    if (!this._hass || !this._config || !this._el) return;
    const c = this._config;
    const stateObj = this._hass.states[c.entity];
    const el = this._el;

    el.card.style.setProperty("--mbc-height", `${Number(c.height) || 8}px`);
    el.card.style.setProperty("--mbc-icon-bg", c.icon_background ? "20%" : "0%");

    if (!stateObj) {
      el.name.textContent = c.name || c.entity;
      el.value.textContent = "Entity not found";
      el.card.classList.add("unavailable");
      this.style.setProperty("--mbc-color", `rgb(${NAMED.disabled})`);
      return;
    }

    const v = parseFloat(stateObj.state);
    const ok = !isNaN(v) && !["unavailable", "unknown"].includes(stateObj.state);
    const color = ok ? this._colorFor(v) : `rgb(${NAMED.disabled})`;
    this.style.setProperty("--mbc-color", color);

    el.icon.hass = this._hass;
    el.icon.stateObj = stateObj;
    if (c.icon) el.icon.icon = c.icon;

    el.name.textContent = c.name || stateObj.attributes.friendly_name || c.entity;
    el.value.textContent = ok ? this._formatValue(stateObj, v) : "N/A";
    el.card.classList.toggle("unavailable", !ok);

    const p = ok ? this._pct(v) : 0;
    el.fill.style.width = `${p}%`;

    if (c.target !== undefined && c.target !== null && ok) {
      const t = this._pct(Number(c.target));
      // Runs from the left edge, behind the fill, so only its rounded end shows.
      el.target.style.display = "block";
      el.target.style.width = `${t}%`;
    } else {
      el.target.style.display = "none";
    }
  }

  /* --- actions: tap / hold / double-tap via the standard 'hass-action' event --- */
  _bindActions(target) {
    let holdTimer, held = false, lastTap = 0, tapTimer;
    const fire = (action) => {
      const cfg = this._config;
      if (!cfg[`${action}_action`] || cfg[`${action}_action`].action === "none") return;
      this.dispatchEvent(new CustomEvent("hass-action", {
        bubbles: true, composed: true,
        detail: { config: { entity: cfg.entity, ...cfg }, action },
      }));
    };
    target.addEventListener("pointerdown", () => {
      held = false;
      holdTimer = setTimeout(() => { held = true; fire("hold"); }, 500);
    });
    const cancel = () => clearTimeout(holdTimer);
    target.addEventListener("pointerup", cancel);
    target.addEventListener("pointerleave", cancel);
    target.addEventListener("pointercancel", cancel);
    target.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (held) return;
      if (!this._config.double_tap_action) return fire("tap");
      const now = Date.now();
      if (now - lastTap < 250) { clearTimeout(tapTimer); lastTap = 0; fire("double_tap"); }
      else { lastTap = now; tapTimer = setTimeout(() => fire("tap"), 250); }
    });
  }
}

if (!customElements.get("mushroom-bar-card")) {
  customElements.define("mushroom-bar-card", MushroomBarCard);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "mushroom-bar-card",
    name: "Mushroom Bar Card",
    description: "Compact Mushroom-style progress bar with severity colours for icon and bar.",
    documentationURL: "https://github.com/arnocl/mushroom-bar-card",
    preview: true,
  });
  console.info(`%c MUSHROOM-BAR-CARD %c v${VERSION} `, "background:#44739e;color:#fff", "background:#ddd;color:#000");
}
