/* @ds-bundle system-six — window.SystemSix + custom elements */
"use strict";
var SystemSix = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/index.ts
  var index_exports = {};
  __export(index_exports, {
    S6Button: () => S6Button,
    S6Dither: () => S6Dither,
    S6FinderIcon: () => S6FinderIcon,
    S6IconGrid: () => S6IconGrid,
    S6SectionRule: () => S6SectionRule,
    S6Status: () => S6Status,
    S6ThemeToggle: () => S6ThemeToggle,
    S6Window: () => S6Window
  });

  // src/dom.ts
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  function projectChildren(from, to) {
    const frag = document.createDocumentFragment();
    while (from.firstChild) frag.appendChild(from.firstChild);
    to.appendChild(frag);
  }
  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  // src/elements/window.ts
  var S6Window = class extends HTMLElement {
    wrapped = false;
    connectedCallback() {
      onReady(() => this.upgrade());
    }
    upgrade() {
      if (this.wrapped) return;
      this.wrapped = true;
      const win = el("div", "window");
      const bar = el("div", "title-bar");
      bar.appendChild(el("span", "title", this.getAttribute("title") ?? ""));
      win.appendChild(bar);
      const details = this.getAttribute("details");
      if (details != null) {
        const d = el("div", "details-bar");
        d.appendChild(el("span", void 0, details));
        win.appendChild(d);
      }
      const body = el("div", "window-body");
      projectChildren(this, body);
      win.appendChild(body);
      this.appendChild(win);
    }
  };
  customElements.define("s6-window", S6Window);

  // src/elements/button.ts
  var S6Button = class extends HTMLElement {
    wrapped = false;
    connectedCallback() {
      onReady(() => this.upgrade());
    }
    upgrade() {
      if (this.wrapped) return;
      this.wrapped = true;
      const btn = document.createElement("button");
      btn.className = "btn";
      if (this.hasAttribute("disabled")) btn.setAttribute("disabled", "");
      projectChildren(this, btn);
      this.appendChild(btn);
    }
  };
  customElements.define("s6-button", S6Button);

  // src/elements/dither.ts
  var DENSITIES = /* @__PURE__ */ new Set(["light", "25", "50", "75", "hatch"]);
  var S6Dither = class extends HTMLElement {
    wrapped = false;
    connectedCallback() {
      onReady(() => this.upgrade());
    }
    upgrade() {
      if (this.wrapped) return;
      this.wrapped = true;
      const raw = this.getAttribute("density") ?? "25";
      const density = DENSITIES.has(raw) ? raw : "25";
      const box = el("div", `dither-${density}`);
      projectChildren(this, box);
      this.appendChild(box);
    }
  };
  customElements.define("s6-dither", S6Dither);

  // src/elements/section-rule.ts
  var S6SectionRule = class extends HTMLElement {
    wrapped = false;
    connectedCallback() {
      onReady(() => this.upgrade());
    }
    upgrade() {
      if (this.wrapped) return;
      this.wrapped = true;
      const rule = el("div", "section-rule");
      projectChildren(this, rule);
      this.appendChild(rule);
    }
  };
  customElements.define("s6-section-rule", S6SectionRule);

  // src/elements/icon-grid.ts
  var S6IconGrid = class extends HTMLElement {
    wrapped = false;
    connectedCallback() {
      onReady(() => this.upgrade());
    }
    upgrade() {
      if (this.wrapped) return;
      this.wrapped = true;
      const grid = el("div", "icon-grid");
      projectChildren(this, grid);
      this.appendChild(grid);
    }
  };
  customElements.define("s6-icon-grid", S6IconGrid);

  // src/elements/finder-icon.ts
  var S6FinderIcon = class extends HTMLElement {
    wrapped = false;
    connectedCallback() {
      if (this.wrapped) return;
      this.wrapped = true;
      const a = el("a", "finder-icon");
      const href = this.getAttribute("href");
      if (href) a.setAttribute("href", href);
      const label = this.getAttribute("label") ?? "";
      const src = this.getAttribute("src");
      if (src) {
        const box = el("span", "icon-box");
        const img = el("img", "icon-glyph");
        img.setAttribute("src", src);
        img.setAttribute("alt", label);
        box.appendChild(img);
        a.appendChild(box);
      }
      a.appendChild(el("span", "icon-label", label));
      this.appendChild(a);
    }
  };
  customElements.define("s6-finder-icon", S6FinderIcon);

  // src/elements/status.ts
  var STATES = /* @__PURE__ */ new Set(["success", "warning", "danger", "idle"]);
  var S6Status = class extends HTMLElement {
    static observedAttributes = ["state", "label"];
    wrapped = false;
    connectedCallback() {
      if (this.wrapped) return;
      this.wrapped = true;
      const wrap = el("span", "s6-status");
      wrap.appendChild(el("span", "s6-status-dot", "\u25CF"));
      wrap.appendChild(el("span", "s6-status-label"));
      this.appendChild(wrap);
      this.setAttribute("role", "status");
      this.update();
    }
    attributeChangedCallback() {
      if (this.wrapped) this.update();
    }
    update() {
      const raw = this.getAttribute("state") ?? "idle";
      const state = STATES.has(raw) ? raw : "idle";
      const wrap = this.firstElementChild;
      wrap.className = `s6-status s6-status--${state}`;
      wrap.querySelector(".s6-status-label").textContent = this.getAttribute("label") ?? "";
    }
  };
  customElements.define("s6-status", S6Status);

  // src/elements/theme-toggle.ts
  var S6ThemeToggle = class extends HTMLElement {
    wrapped = false;
    connectedCallback() {
      if (this.wrapped) return;
      this.wrapped = true;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "theme-toggle";
      btn.innerHTML = '<i class="bi bi-circle-half" aria-hidden="true"></i>';
      const sync = () => {
        const dark = document.documentElement.dataset.theme === "dark";
        btn.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
        btn.setAttribute("aria-pressed", String(dark));
      };
      btn.addEventListener("click", () => {
        const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem("sm-theme", next);
        } catch {
        }
        sync();
      });
      sync();
      this.appendChild(btn);
    }
  };
  customElements.define("s6-theme-toggle", S6ThemeToggle);
  return __toCommonJS(index_exports);
})();
//# sourceMappingURL=system-six.global.js.map
