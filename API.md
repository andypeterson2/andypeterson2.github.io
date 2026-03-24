# UI Kit API Reference

Concise reference for every JavaScript method, CSS component, design token, and icon in the library. For tutorials and quick-start guides, see [README.md](README.md) and [USAGE.md](USAGE.md).

---

## Table of Contents

- [JavaScript API](#javascript-api)
  - [UIKit.initThemeToggle()](#ukitInitThemeToggle)
  - [UIKit.initDrawer()](#ukitInitDrawer)
  - [UIKit.initDropdown()](#ukitInitDropdown)
  - [UIKit.onEscape()](#ukitOnEscape)
  - [UIKit.initResize()](#ukitInitResize)
  - [UIKit.createLogger()](#ukitCreateLogger)
  - [UIKit.toast()](#ukitToast)
  - [UIKit.dismissToast()](#ukitDismissToast)
  - [UIKit.initFadeIn()](#ukitInitFadeIn)
  - [UIKit.initConnect()](#ukitInitConnect)
  - [UIKit.icon()](#ukitIcon)
  - [UIKit.ICONS](#ukitIcons)
- [CSS Components](#css-components)
- [Design Tokens](#design-tokens)
- [Icons](#icons)

---

## JavaScript API

Load `icons.js` first, then `ui-kit.js`. All methods live on `window.UIKit`. Nothing auto-initialises.

```html
<script src="ui-kit/icons.js"></script>
<script src="ui-kit/ui-kit.js"></script>
```

---

### `UIKit.initThemeToggle(el, opts?)`

Initialise a dark/light theme toggle button with localStorage persistence.

| Parameter | Type | Description |
|-----------|------|-------------|
| `el` | `HTMLElement` | The toggle button element |
| `opts.key` | `string` | localStorage key (default: `"sm-theme"`) |
| `opts.darkIcon` | `string` | HTML for the "switch to dark" icon (default: moon icon) |
| `opts.lightIcon` | `string` | HTML for the "switch to light" icon (default: sun icon) |

**Returns:** `{ setTheme(t: string): void, destroy(): void }`

```js
var toggle = UIKit.initThemeToggle(document.getElementById("theme-toggle"));
toggle.setTheme("dark");   // programmatic switch
toggle.destroy();           // remove event listener
```

---

### `UIKit.initDrawer(drawerEl, handleEl)`

Initialise a collapsible drawer. Toggles the `.open` class and sets `aria-expanded`.

| Parameter | Type | Description |
|-----------|------|-------------|
| `drawerEl` | `HTMLElement` | The `.drawer` container |
| `handleEl` | `HTMLElement` | The `.side-handle` toggle button |

**Returns:** `{ open(): void, close(): void, toggle(): void, destroy(): void }`

```js
var drawer = UIKit.initDrawer(
  document.getElementById("drawer"),
  document.getElementById("handle")
);
drawer.open();
drawer.close();
drawer.toggle();
drawer.destroy();
```

---

### `UIKit.initDropdown(triggerEl, menuEl)`

Initialise a dropdown menu with toggle and click-outside-to-close behaviour.

| Parameter | Type | Description |
|-----------|------|-------------|
| `triggerEl` | `HTMLElement` | The button that toggles the menu |
| `menuEl` | `HTMLElement` | The `.ui-dropdown` container |

**Returns:** `{ open(): void, close(): void, destroy(): void }`

```js
var dd = UIKit.initDropdown(
  document.getElementById("trigger"),
  document.getElementById("menu")
);
dd.open();
dd.close();
dd.destroy();
```

---

### `UIKit.onEscape(callback)`

Register a callback that fires when the Escape key is pressed. Multiple callbacks are supported; a single global listener is shared.

| Parameter | Type | Description |
|-----------|------|-------------|
| `callback` | `function(): void` | Called on each Escape keypress |

**Returns:** `function(): void` -- unsubscribe function.

```js
var unsub = UIKit.onEscape(function () {
  modal.classList.add("hidden");
});
unsub(); // stop listening
```

---

### `UIKit.initResize(handleEl, targetEl, containerEl, opts?)`

Initialise a drag-to-resize handle for a split layout. Persists width to localStorage when a key is provided.

| Parameter | Type | Description |
|-----------|------|-------------|
| `handleEl` | `HTMLElement` | The `.resize-handle` element |
| `targetEl` | `HTMLElement` | The element whose width is adjusted |
| `containerEl` | `HTMLElement` | The parent flex container |
| `opts.min` | `number` | Minimum width in px (default: `180`) |
| `opts.max` | `number` | Maximum width in px (default: container width - min) |
| `opts.default` | `number` | Default width in px (default: `300`) |
| `opts.key` | `string` | localStorage key for persistence |

**Returns:** `void`

```js
UIKit.initResize(
  document.getElementById("handle"),
  document.getElementById("left"),
  document.getElementById("split"),
  { min: 200, "default": 300, key: "split-w" }
);
```

---

### `UIKit.createLogger(terminalEl, max?)`

Create a log appender for a `.log-terminal` element. Entries auto-scroll and are capped at a maximum count.

| Parameter | Type | Description |
|-----------|------|-------------|
| `terminalEl` | `HTMLElement` | The `.log-terminal` container |
| `max` | `number` | Maximum retained entries (default: `200`) |

**Returns:** `function(msg: string, level?: string): void`

Level values: `"ok"` (green), `"warn"` (amber), `"err"` (red), or omit for default.

```js
var log = UIKit.createLogger(document.getElementById("log"), 500);
log("Dataset loaded", "ok");
log("Low sample count", "warn");
log("Validation failed", "err");
log("Processing...");
```

---

### `UIKit.toast(message, opts?)`

Show a toast notification at the top of the viewport.

| Parameter | Type | Description |
|-----------|------|-------------|
| `message` | `string` | Text to display |
| `opts.type` | `string` | `"success"`, `"warn"`, or `"error"` |
| `opts.duration` | `number` | Auto-dismiss in ms (default: `3000`; `0` = manual) |
| `opts.container` | `string` | Selector for a custom container |

**Returns:** `HTMLElement` -- the toast element (can be passed to `dismissToast`).

```js
UIKit.toast("Saved successfully", { type: "success" });
UIKit.toast("Connection lost", { type: "error", duration: 0 });
```

---

### `UIKit.dismissToast(toast)`

Dismiss a toast element with a fade-out animation.

| Parameter | Type | Description |
|-----------|------|-------------|
| `toast` | `HTMLElement` | The toast element returned by `UIKit.toast()` |

**Returns:** `void`

```js
var t = UIKit.toast("Processing...", { duration: 0 });
UIKit.dismissToast(t);
```

---

### `UIKit.initFadeIn(scope?, opts?)`

Observe `.ui-fade-in` elements and add `.visible` when they scroll into view via IntersectionObserver.

| Parameter | Type | Description |
|-----------|------|-------------|
| `scope` | `string \| HTMLElement` | Scope selector or element (default: `document`) |
| `opts.threshold` | `number` | Intersection threshold (default: `0.15`) |

**Returns:** `void`

```js
UIKit.initFadeIn();                          // whole page
UIKit.initFadeIn("#content", { threshold: 0.3 });
```

---

### `UIKit.initConnect(el, opts)`

Initialise a server-connect widget with host:port inputs and a status indicator dot.

| Parameter | Type | Description |
|-----------|------|-------------|
| `el` | `HTMLElement` | Container element |
| `opts.service` | `string` | ServiceConfig key for persistence |
| `opts.defaultHost` | `string` | Default host (default: `"localhost"`) |
| `opts.defaultPort` | `number` | Default port (default: `8080`) |
| `opts.protocol` | `string` | URL protocol (default: `"https"`) |
| `opts.label` | `string` | Label text (default: `"Server"`) |
| `opts.onConnect` | `function` | Called with `{ host, port, url }` on connect |

**Returns:** `{ getUrl(): string, setStatus(s: string, msg?: string): void, destroy(): void }`

Status values: `"connected"`, `"connecting"`, `"disconnected"`, `"error"`, `"idle"`.

```js
var conn = UIKit.initConnect(document.getElementById("server"), {
  service: "api",
  defaultHost: "localhost",
  defaultPort: 5055,
  onConnect: function (info) { console.log(info.url); }
});
conn.setStatus("connected");
conn.setStatus("error", "Timeout after 5s");
```

---

### `UIKit.icon(name, opts?)`

Get an icon's HTML markup by name.

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `string` | Icon name (key in `UIKit.ICONS`) |
| `opts` | `Object` | Reserved for future use |

**Returns:** `string` -- HTML string, or `""` if not found.

```js
el.innerHTML = UIKit.icon("play");
```

---

### `UIKit.ICONS`

Object containing all icon HTML strings. See the [Icons](#icons) section for the full list.

```js
el.innerHTML = UIKit.ICONS.play;
btn.innerHTML = UIKit.ICONS.play + " Train Model";
```

---

## CSS Components

All styles use class selectors. No IDs, no tag selectors. Components are in `components/` and aggregated by `components.css`.

---

### Alert

File: `components/alert.css`

Inline status messages and notification banners.

| Class | Description |
|-------|-------------|
| `.ui-alert` | Base alert container |
| `.ui-alert-success` | Green border + text |
| `.ui-alert-warn` | Amber border + text |
| `.ui-alert-danger` | Red border + text |
| `.ui-alert-accent` | Accent border + text |

```html
<div class="ui-alert ui-alert-success">Operation completed.</div>
<div class="ui-alert ui-alert-danger">Invalid input.</div>
```

---

### Aspect Ratio

File: `components/aspect-ratio.css`

Fixed-ratio containers for video, images, and embeds. Child elements are absolutely positioned to fill.

| Class | Description |
|-------|-------------|
| `.ui-ratio` | Base container |
| `.ui-ratio-16x9` | 16:9 ratio |
| `.ui-ratio-4x3` | 4:3 ratio |
| `.ui-ratio-1x1` | Square |
| `.ui-ratio-21x9` | Ultra-wide 21:9 |

```html
<div class="ui-ratio ui-ratio-16x9">
  <video src="demo.mp4"></video>
</div>
```

---

### Avatar

File: `components/avatar.css`

Circular profile images or placeholder initials.

| Class | Description |
|-------|-------------|
| `.ui-avatar` | Base (40x40px) |
| `.ui-avatar-round` | Circular border-radius |
| `.ui-avatar-sm` | 28x28px |
| `.ui-avatar-lg` | 64x64px |
| `.ui-avatar-xl` | 96x96px |

```html
<div class="ui-avatar ui-avatar-round">
  <img src="photo.jpg" alt="User">
</div>
<div class="ui-avatar ui-avatar-round ui-avatar-sm">AP</div>
```

---

### Badges

File: `components/badges.css`

Small inline labels for status, metadata, counts, or tags.

| Class | Description |
|-------|-------------|
| `.ui-badge` | Base badge (uppercase, bordered) |
| `.ui-badge-accent` | Filled accent background |
| `.ui-badge-success` | Green outline |
| `.ui-badge-warn` | Amber outline |
| `.ui-badge-danger` | Red outline |

```html
<span class="ui-badge">Default</span>
<span class="ui-badge ui-badge-accent">New</span>
<span class="ui-badge ui-badge-success">Active</span>
```

---

### Breadcrumb

File: `components/breadcrumb.css`

Navigation path indicator with separator.

| Class | Description |
|-------|-------------|
| `.ui-breadcrumb` | Flex container |
| `.ui-breadcrumb-sep` | Separator (renders `/` via `::after`) |
| `.ui-breadcrumb-current` | Current page (bold, no link) |

```html
<nav class="ui-breadcrumb">
  <a href="/">Home</a>
  <span class="ui-breadcrumb-sep"></span>
  <a href="/projects">Projects</a>
  <span class="ui-breadcrumb-sep"></span>
  <span class="ui-breadcrumb-current">QKD Chat</span>
</nav>
```

---

### Button Group

File: `components/button-group.css`

Segmented control with collapsed borders. Uses `.btn` children.

| Class | Description |
|-------|-------------|
| `.ui-btn-group` | Inline-flex container |
| `.btn.active` | Active state (accent fill) |

```html
<div class="ui-btn-group">
  <button class="btn active">Grid</button>
  <button class="btn">List</button>
  <button class="btn">Table</button>
</div>
```

---

### Buttons

File: `components/buttons.css`

| Class | Description |
|-------|-------------|
| `.btn` | Base button |
| `.btn-primary` | Accent-filled |
| `.btn-secondary` | Outlined |
| `.btn-danger` | Red variant |
| `.btn-icon` | Square icon-only |
| `.btn-loading` | Disabled with spinner cursor |

```html
<button class="btn btn-primary">Save</button>
<button class="btn btn-secondary">Cancel</button>
<button class="btn btn-danger">Delete</button>
<button class="btn btn-icon"><!-- icon --></button>
<button class="btn btn-primary btn-loading" disabled>Saving...</button>
```

---

### Canvas

File: `components/canvas.css`

Drawing canvas with clear button overlay.

| Class | Description |
|-------|-------------|
| `.ui-canvas` | Black canvas with crosshair cursor |
| `.ui-canvas-clear` | Overlay clear/close button |
| `.canvas-area` | Outer wrapper |
| `.canvas-wrap` | Relative-positioned inner wrapper |
| `.canvas-hint` | Hint text below canvas |

```html
<div class="canvas-area">
  <div class="canvas-wrap">
    <canvas class="ui-canvas" width="200" height="120"></canvas>
    <button class="ui-canvas-clear">Clear</button>
  </div>
  <div class="canvas-hint">Draw a digit</div>
</div>
```

---

### Cards

File: `components/cards.css`

Surface-coloured panels. Stacked cards auto-collapse borders.

| Class | Description |
|-------|-------------|
| `.card` | Panel with border and padding |
| `.card-header` | Flex row for title + actions |
| `.card-form` | Form wrapper inside a card |

```html
<div class="card">
  <div class="card-header">
    <h2>Settings</h2>
    <button class="btn btn-secondary">Reset</button>
  </div>
  <p>Content</p>
</div>
```

---

### Chat

File: `components/chat.css`

Message display for chat and conversation UIs.

| Class | Description |
|-------|-------------|
| `.ui-chat` | Flex column container |
| `.ui-chat-messages` | Scrollable message area |
| `.ui-chat-msg` | Single message bubble |
| `.ui-chat-msg-self` | Right-aligned self message |
| `.ui-chat-msg-system` | Centered system message |
| `.ui-chat-meta` | Timestamp/metadata text |
| `.ui-chat-input` | Input row with text field + send button |

```html
<div class="ui-chat">
  <div class="ui-chat-messages">
    <div class="ui-chat-msg">Hello!</div>
    <div class="ui-chat-msg ui-chat-msg-self">Hi there!</div>
    <div class="ui-chat-msg ui-chat-msg-system">User joined</div>
  </div>
  <div class="ui-chat-input">
    <input type="text" placeholder="Type a message...">
    <button>Send</button>
  </div>
</div>
```

---

### Code

File: `components/code.css`

Inline code and code blocks.

| Class | Description |
|-------|-------------|
| `.ui-code` | Inline code span (monospace, bordered) |
| `.ui-code-block` | Pre-formatted code block (terminal background) |

```html
<span class="ui-code">const x = 42;</span>

<pre class="ui-code-block">function hello() {
  console.log("world");
}</pre>
```

---

### Collapsible

File: `components/collapsible.css`

Accordion sections using native `<details>`/`<summary>`. Stacked collapsibles collapse borders.

| Class | Description |
|-------|-------------|
| `.ui-collapsible` | Wrapper (apply to `<details>`) |
| `.ui-collapsible-body` | Content area |

```html
<details class="ui-collapsible">
  <summary>Advanced Options</summary>
  <div class="ui-collapsible-body">Content here</div>
</details>
```

---

### Connect Widget

File: `components/connect.css`

Host:port connection form with status indicator. Rendered by `UIKit.initConnect()`.

| Class | Description |
|-------|-------------|
| `.ui-connect` | Container |
| `.ui-connect-row` | Flex row |
| `.ui-connect-label` | Label text |
| `.ui-connect-host` | Host input |
| `.ui-connect-port` | Port input |
| `.ui-connect-btn` | Connect button |
| `.ui-connect-btn.connected` | Connected state |
| `.ui-connect-dot` | Status dot (`data-state`: `connected`, `connecting`, `disconnected`, `idle`) |
| `.ui-connect-state` | Status text |

---

### Divider

File: `components/divider.css`

Horizontal and vertical section separators.

| Class | Description |
|-------|-------------|
| `.ui-divider` | Horizontal rule |
| `.ui-divider-thick` | 2px border |
| `.ui-divider-accent` | Accent-coloured |
| `.ui-divider-v` | Vertical divider |
| `.ui-divider-label` | Divider with centered label text |

```html
<hr class="ui-divider">
<hr class="ui-divider ui-divider-accent">
<div class="ui-divider-label">Section</div>
```

---

### Drag Handle

File: `components/drag-handle.css`

Visual grip indicator for sortable items.

| Class | Description |
|-------|-------------|
| `.ui-drag-handle` | Grip dots (`cursor: grab`) |
| `.ui-sortable-ghost` | Ghost state during drag (reduced opacity) |
| `.ui-sortable-chosen` | Chosen item (accent outline) |

```html
<div class="ui-list-row">
  <span class="ui-drag-handle"></span>
  <span>Item name</span>
</div>
```

---

### Drawers

File: `components/drawers.css`

Collapsible side panels with toggle handle.

| Class | Description |
|-------|-------------|
| `.drawer` | Container |
| `.drawer-left` | Left-positioned variant |
| `.drawer.open` | Slides panel into view |
| `.side-handle` | Toggle tab |
| `.side-handle-left` | Left-positioned handle |
| `.side-panel` | Panel content area |
| `.side-panel-left` | Left-positioned panel |
| `.side-panel-header` | Panel header row |
| `.side-panel-title` | Panel title text |

---

### Dropdowns

File: `components/dropdowns.css`

Absolutely-positioned menus.

| Class | Description |
|-------|-------------|
| `.ui-dropdown` | Menu container (add `.hidden` to hide) |
| `.ui-dropdown-item` | Clickable row |
| `.ui-dropdown-item.active` | Active/selected state |

```html
<div style="position:relative">
  <button class="btn btn-secondary" id="trigger">Options</button>
  <div class="ui-dropdown hidden" id="menu">
    <button class="ui-dropdown-item active">Option A</button>
    <button class="ui-dropdown-item">Option B</button>
  </div>
</div>
```

---

### Empty State

File: `components/empty-state.css`

Placeholder for empty lists, tables, or content areas.

| Class | Description |
|-------|-------------|
| `.ui-empty` | Centered italic muted text |

```html
<div class="ui-empty">No items yet</div>
```

---

### Fade-In

File: `components/fade.css`

Scroll-triggered reveal animation. Use with `UIKit.initFadeIn()`. Respects `prefers-reduced-motion`.

| Class | Description |
|-------|-------------|
| `.ui-fade-in` | Hidden state (opacity 0, shifted down) |
| `.ui-fade-in.visible` | Visible state (opacity 1, in place) |

Stagger delays are built in for children 2 through 6.

```html
<div class="ui-fade-in">Appears on scroll</div>
```

---

### Fieldset

File: `components/fieldset.css`

Form section groups.

| Class | Description |
|-------|-------------|
| `.ui-fieldset` | Bordered fieldset |
| `.ui-fieldset-borderless` | No border variant |

```html
<fieldset class="ui-fieldset">
  <legend>Connection</legend>
  <!-- form rows -->
</fieldset>
```

---

### Forms

File: `components/forms.css`

| Class | Description |
|-------|-------------|
| `.form-row` | Label + input grid row |
| `.control-row` | Select + action buttons row |
| `.feature-row` | Inline labelled numeric inputs |
| `.feature-label` | Label within feature row |
| `.feature-input` | Input within feature row |

---

### Grid

File: `components/grid.css`

Responsive 2-column card grid with border-collapse. Goes single-column below 600px.

| Class | Description |
|-------|-------------|
| `.ui-grid` | Grid container (2 columns) |
| `.ui-grid-card` | Grid item with hover accent border |
| `.ui-grid-title` | Card title |
| `.ui-grid-desc` | Card description |
| `.ui-grid-tags` | Tag container |
| `.ui-grid-tag` | Individual tag |

```html
<div class="ui-grid">
  <div class="ui-grid-card">
    <div class="ui-grid-title">Project</div>
    <div class="ui-grid-desc">Description text</div>
    <div class="ui-grid-tags">
      <span class="ui-grid-tag">Python</span>
    </div>
  </div>
</div>
```

---

### Icons

File: `components/icons.css`

| Class | Description |
|-------|-------------|
| `.icon` | 16x16 inline-flex container |
| `.icon-spin` | Rotation animation |

---

### Kbd

File: `components/kbd.css`

Keyboard shortcut display.

| Class | Description |
|-------|-------------|
| `.ui-kbd` | Monospace key cap with bottom border |

```html
Press <span class="ui-kbd">Ctrl</span> + <span class="ui-kbd">S</span> to save.
```

---

### Layout

File: `components/layout.css`

Full-viewport app shell.

| Class | Description |
|-------|-------------|
| `.app` | Root flex container |
| `.app-topbar` | Sticky top bar |
| `.app-body` | Flex row for sidebar + main |
| `.app-sidebar` | Fixed-width sidebar |
| `.app-main` | Main content area |
| `.split-layout` | Horizontal flex container for resizable columns |
| `.left-col` | Left column |
| `.right-col` | Right column |
| `.resize-handle` | Draggable divider |
| `.resize-h` | Horizontal resize variant |

---

### Lists

File: `components/lists.css`

Scrollable row-based lists.

| Class | Description |
|-------|-------------|
| `.ui-list` | Container |
| `.ui-list-row` | Single row (flex layout) |
| `.ui-list-name` | Item name |
| `.ui-list-tag` | Badge/tag in row |

```html
<div class="ui-list">
  <div class="ui-list-row">
    <span class="ui-list-name">model_v3.pkl</span>
    <span class="ui-list-tag">96.7%</span>
    <button class="btn btn-icon"><!-- icon --></button>
  </div>
</div>
```

---

### Log Terminal

File: `components/log-terminal.css`

Monospace scrollable log area. Use with `UIKit.createLogger()`.

| Class | Description |
|-------|-------------|
| `.log-terminal` | Container |
| `.log-entry` | Single log line |
| `.log-time` | Timestamp span |
| `.log-msg` | Message span |
| `.log-ok` | Green text |
| `.log-warn` | Amber text |
| `.log-err` | Red text |

---

### Modals

File: `components/modals.css`

Overlay + centered dialog.

| Class | Description |
|-------|-------------|
| `.modal-overlay` | Full-viewport overlay (add `.hidden` to hide) |
| `.modal` | Centered dialog box |
| `.modal-header` | Title + close button row |
| `.modal-title` | Title text |
| `.modal-footer` | Action buttons row |

```html
<div class="modal-overlay" id="modal">
  <div class="modal">
    <div class="modal-header">
      <span class="modal-title">Confirm</span>
      <button class="btn btn-icon"><!-- close --></button>
    </div>
    <p>Are you sure?</p>
    <div class="modal-footer">
      <button class="btn btn-secondary">Cancel</button>
      <button class="btn btn-danger">Delete</button>
    </div>
  </div>
</div>
```

---

### Navbar

File: `components/navbar.css`

Fixed top navigation bar with hamburger toggle and slide-out trays.

| Class | Description |
|-------|-------------|
| `.ui-navbar-wrapper` | Fixed wrapper (`z-index: 1000`) |
| `.ui-navbar` | Bar container (44px height) |
| `.ui-navbar-brand` | Brand link/text (left-aligned) |
| `.ui-navbar-pinned` | Pinned nav link with hover/active |
| `.ui-navbar-toggle` | Hamburger button (hidden above 700px) |
| `.ui-navbar-menu` | Nav links container (collapses to dropdown on mobile) |
| `.ui-navbar-menu.open` | Mobile expanded state |
| `.ui-navbar-tray--bottom` | Connection/status bar below navbar |
| `.ui-navbar-tray--left` | Left slide-out panel |
| `.ui-navbar-tray--right` | Right slide-out panel |
| `.ui-navbar-tray--left.open` | Visible state |
| `.ui-navbar-tray--right.open` | Visible state |

```html
<div class="ui-navbar-wrapper">
  <nav class="ui-navbar">
    <a class="ui-navbar-brand" href="/">App</a>
    <div class="ui-navbar-menu">
      <a href="/dashboard" class="active">Dashboard</a>
      <a href="/settings">Settings</a>
    </div>
  </nav>
</div>
```

---

### Pagination

File: `components/pagination.css`

Page navigation with collapsed borders.

| Class | Description |
|-------|-------------|
| `.ui-pagination` | Flex container |
| `.ui-page` | Page button/link |
| `.ui-page.active` | Current page (accent fill) |
| `.ui-page.disabled` | Disabled state |
| `.ui-page-ellipsis` | Ellipsis separator |

```html
<nav class="ui-pagination">
  <button class="ui-page disabled">&laquo;</button>
  <button class="ui-page">1</button>
  <button class="ui-page active">2</button>
  <button class="ui-page">3</button>
  <span class="ui-page-ellipsis">...</span>
  <button class="ui-page">10</button>
  <button class="ui-page">&raquo;</button>
</nav>
```

---

### Picture-in-Picture

File: `components/pip.css`

Corner-positioned overlay for video previews.

| Class | Description |
|-------|-------------|
| `.ui-pip` | Absolute-positioned container |
| `.ui-pip-tr` | Top-right corner |
| `.ui-pip-tl` | Top-left corner |
| `.ui-pip-br` | Bottom-right corner |
| `.ui-pip-bl` | Bottom-left corner |
| `.ui-pip-sm` | 120x68px |
| `.ui-pip-md` | 180x101px |
| `.ui-pip-lg` | 240x135px |

```html
<div style="position:relative">
  <video class="main-video"></video>
  <div class="ui-pip ui-pip-br ui-pip-sm">
    <video src="self.mp4"></video>
  </div>
</div>
```

---

### Progress Bar

File: `components/progress.css`

| Class | Description |
|-------|-------------|
| `.progress-area` | Wrapper (add `.hidden` when inactive) |
| `.progress-bar-wrap` | Track |
| `.progress-bar` | Fill (set `width` via style) |
| `.status-text` | Status label below bar |

```html
<div class="progress-area">
  <div class="progress-bar-wrap">
    <div class="progress-bar" style="width:65%"
         role="progressbar" aria-valuenow="65"></div>
  </div>
  <div class="status-text">65%</div>
</div>
```

---

### Resize Handle

File: `components/resize.css`

Draggable panel dividers. Use with `UIKit.initResize()`.

| Class | Description |
|-------|-------------|
| `.ui-resize-handle` | Base handle (highlights on hover) |
| `.ui-resize-v` | Vertical divider (5px wide, `col-resize`) |
| `.ui-resize-h` | Horizontal divider (5px tall, `row-resize`) |

---

### Scrollbar

File: `components/scrollbar.css`

Custom scrollbar styling (WebKit).

| Class | Description |
|-------|-------------|
| `.ui-scrollbar` | 6px scrollbar with themed track/thumb |
| `.ui-scrollbar-thin` | 4px thin variant |

```html
<div class="ui-scrollbar" style="overflow-y:auto; max-height:300px">
  <!-- scrollable content -->
</div>
```

---

### Sidebar Nav

File: `components/sidebar-nav.css`

Vertical navigation list with active indicator border.

| Class | Description |
|-------|-------------|
| `.ui-sidebar-nav` | Flex column container |
| `.ui-sidebar-nav a` | Nav link |
| `.ui-sidebar-nav a.active` | Active link (accent left border) |
| `.ui-sidebar-nav-heading` | Section heading |

```html
<nav class="ui-sidebar-nav">
  <div class="ui-sidebar-nav-heading">Main</div>
  <a href="/dashboard" class="active">Dashboard</a>
  <a href="/settings">Settings</a>
</nav>
```

---

### Skeleton

File: `components/skeleton.css`

Loading placeholder with shimmer animation. Respects `prefers-reduced-motion`.

| Class | Description |
|-------|-------------|
| `.ui-skeleton` | Base shimmer element |
| `.ui-skeleton-text` | Text line placeholder (12px height) |
| `.ui-skeleton-heading` | Heading placeholder (18px, 40% width) |
| `.ui-skeleton-avatar` | 40x40 avatar placeholder |
| `.ui-skeleton-avatar-round` | Circular avatar variant |
| `.ui-skeleton-block` | Block placeholder (80px height) |

```html
<div class="ui-skeleton ui-skeleton-heading"></div>
<div class="ui-skeleton ui-skeleton-text"></div>
<div class="ui-skeleton ui-skeleton-text"></div>
<div class="ui-skeleton ui-skeleton-text"></div>
```

---

### Skip Link

File: `components/skip-link.css`

Accessibility skip-to-content link, only visible on keyboard focus.

| Class | Description |
|-------|-------------|
| `.ui-skip-link` | Hidden link, appears fixed top-left on `:focus` |

```html
<a class="ui-skip-link" href="#main">Skip to content</a>
```

---

### Spinner

File: `components/spinner.css`

Border-based loading spinner. Respects `prefers-reduced-motion`.

| Class | Description |
|-------|-------------|
| `.ui-spinner` | 20px spinner |
| `.ui-spinner-sm` | 14px small |
| `.ui-spinner-lg` | 32px large |
| `.ui-spinner-inline` | Inline spinner with label text |

```html
<span class="ui-spinner"></span>
<span class="ui-spinner ui-spinner-sm"></span>
<div class="ui-spinner-inline">
  <span class="ui-spinner ui-spinner-sm"></span>
  Loading...
</div>
```

---

### Stat

File: `components/stat.css`

Key-value metric display for dashboards.

| Class | Description |
|-------|-------------|
| `.ui-stat` | Single stat card |
| `.ui-stat-label` | Metric label (uppercase) |
| `.ui-stat-value` | Large value (22px, tabular nums) |
| `.ui-stat-value-sm` | Smaller value (16px) |
| `.ui-stat-change` | Delta/change text |
| `.ui-stat-change-up` | Green (positive) |
| `.ui-stat-change-down` | Red (negative) |
| `.ui-stat-row` | Inline row of stats (collapsed borders) |

```html
<div class="ui-stat-row">
  <div class="ui-stat">
    <div class="ui-stat-label">Accuracy</div>
    <div class="ui-stat-value">96.7%</div>
    <div class="ui-stat-change ui-stat-change-up">+2.1%</div>
  </div>
  <div class="ui-stat">
    <div class="ui-stat-label">Loss</div>
    <div class="ui-stat-value">0.043</div>
  </div>
</div>
```

---

### Status

File: `components/status.css`

Color-coded status indicators.

| Class | Description |
|-------|-------------|
| `.ui-status` | Inline-flex container |
| `.ui-status-dot` | Status dot (8px) |
| `.ui-status-label` | Status text |
| `.ui-status-ok` | Green |
| `.ui-status-warn` | Amber |
| `.ui-status-error` | Red |
| `.ui-status-idle` | Muted |

Text helpers: `.text-ok`, `.text-warn`, `.text-danger`, `.text-muted`.

```html
<span class="ui-status ui-status-ok">
  <span class="ui-status-dot"></span>
  <span class="ui-status-label">Connected</span>
</span>
```

---

### Stepper

File: `components/stepper.css`

Numbered step indicator for wizards and multi-step flows.

| Class | Description |
|-------|-------------|
| `.ui-stepper` | Horizontal flex container |
| `.ui-stepper-v` | Vertical variant |
| `.ui-step` | Step item (auto-numbered via CSS counters) |
| `.ui-step.active` | Current step (accent fill) |
| `.ui-step.completed` | Completed step (green checkmark) |
| `.ui-step-connector` | Line between steps |
| `.ui-step-connector.completed` | Green connector |

```html
<div class="ui-stepper">
  <div class="ui-step completed">Setup</div>
  <div class="ui-step-connector completed"></div>
  <div class="ui-step active">Configure</div>
  <div class="ui-step-connector"></div>
  <div class="ui-step">Deploy</div>
</div>
```

---

### Tables

File: `components/tables.css`

| Class | Description |
|-------|-------------|
| `.ui-table` | Styled table |
| `.ui-table-sticky` | Sticky-header variant |
| `.ui-table-wrap` | Bordered scroll container |
| `.empty-row` | Empty state row |

---

### Tabs

File: `components/tabs.css`

Segmented controls for view switching.

| Class | Description |
|-------|-------------|
| `.ui-tabs` | Flex container |
| `.ui-tab` | Tab button (equal width) |
| `.ui-tab.active` | Active tab |

```html
<div class="ui-tabs">
  <button class="ui-tab active">Train</button>
  <button class="ui-tab">Evaluate</button>
  <button class="ui-tab">Deploy</button>
</div>
```

---

### Theme Toggle

File: `components/theme-toggle.css`

Floating action button for theme switching. Use with `UIKit.initThemeToggle()`.

| Class | Description |
|-------|-------------|
| `.ui-theme-toggle` | Fixed-position FAB |

```html
<button id="theme-toggle" class="ui-theme-toggle"></button>
```

---

### Timeline

File: `components/timeline.css`

Chronological entry list.

| Class | Description |
|-------|-------------|
| `.ui-timeline` | Flex column container |
| `.ui-timeline-entry` | Single entry (bordered) |
| `.ui-timeline-header` | Title + date row |
| `.ui-timeline-title` | Entry title (bold) |
| `.ui-timeline-subtitle` | Secondary text |
| `.ui-timeline-date` | Right-aligned date |
| `.ui-timeline-body` | Description content |

```html
<div class="ui-timeline">
  <div class="ui-timeline-entry">
    <div class="ui-timeline-header">
      <div>
        <div class="ui-timeline-title">Research Intern</div>
        <div class="ui-timeline-subtitle">Qualcomm Institute</div>
      </div>
      <span class="ui-timeline-date">2024 - Present</span>
    </div>
    <div class="ui-timeline-body">
      <ul><li>QKD protocol implementation</li></ul>
    </div>
  </div>
</div>
```

---

### Toasts

File: `components/toasts.css`

Auto-dismissing notification banners. Use with `UIKit.toast()`.

| Class | Description |
|-------|-------------|
| `.ui-toast-container` | Fixed top container |
| `.ui-toast` | Toast element |
| `.ui-toast.visible` | Visible state (animated in) |
| `.ui-toast-success` | Green border |
| `.ui-toast-warn` | Amber border |
| `.ui-toast-error` | Red border |
| `.ui-toast-dismiss` | Manual dismiss button |

---

### Toggle Switch

File: `components/toggle.css`

On/off switch with animated knob.

| Class | Description |
|-------|-------------|
| `.ui-toggle` | Container (36x20px) |
| `.ui-toggle-track` | Background track |
| `.ui-toggle-knob` | Sliding knob |

```html
<label class="ui-toggle">
  <input type="checkbox" checked>
  <span class="ui-toggle-track"></span>
  <span class="ui-toggle-knob"></span>
</label>
```

---

### Toolbar

File: `components/toolbar.css`

Horizontal action bar for grouped controls.

| Class | Description |
|-------|-------------|
| `.ui-toolbar` | Container |
| `.ui-toolbar-gap` | Variant with 6px gap |
| `.ui-toolbar-group` | Button group within toolbar |
| `.ui-toolbar-separator` | Vertical line separator |
| `.ui-toolbar-spacer` | Flex spacer (pushes items right) |
| `.ui-toolbar-label` | Muted label text |

```html
<div class="ui-toolbar">
  <div class="ui-toolbar-group">
    <button class="btn btn-icon"><!-- bold --></button>
    <button class="btn btn-icon"><!-- italic --></button>
  </div>
  <div class="ui-toolbar-separator"></div>
  <span class="ui-toolbar-label">Format</span>
  <div class="ui-toolbar-spacer"></div>
  <button class="btn btn-primary">Save</button>
</div>
```

---

### Tooltip

File: `components/tooltip.css`

CSS-only tooltip on hover via `data-tooltip` attribute.

| Class / Attribute | Description |
|-------------------|-------------|
| `[data-tooltip]` | Any element with this attribute shows a tooltip on hover |

```html
<button class="btn btn-icon" data-tooltip="Delete item">
  <!-- trash icon -->
</button>
```

---

## Design Tokens

All custom properties are defined in `tokens.css`. Dark theme is the default (`:root`); light theme activates via `[data-theme="light"]`.

### Surfaces

| Token | Dark | Light | Description |
|-------|------|-------|-------------|
| `--bg` | `#2d2b22` | `#E1DDD4` | Deepest background |
| `--surface` | `#3a3830` | `#D6D2C8` | Panels, sidebars |
| `--surface2` | `#504d40` | `#C9C8BD` | Modals, dropdowns, hover |
| `--surface-muted` | `#5c5a4d` | `#BDB9AE` | Inactive tabs, separators |
| `--surface-hl` | `#6b6858` | `#B3AFA4` | Selection, active line |

### Borders

| Token | Dark | Light | Description |
|-------|------|-------|-------------|
| `--border` | `#504d40` | `#9e9a8f` | Panel borders, dividers |
| `--border-focus` | `#d8a657` | `#7a5c1f` | Focus rings |
| `--focus-ring` | `rgba(216,166,87,0.4)` | `rgba(122,92,31,0.3)` | Box-shadow focus ring |

### Text

| Token | Dark | Light | Description |
|-------|------|-------|-------------|
| `--text` | `#d4be98` | `#2d2a22` | Primary body text |
| `--text-secondary` | `#b5a993` | `#4a4639` | Dimmed text |
| `--text-muted` | `#ccbba7` | `#6e6a5d` | Placeholder, disabled |
| `--text-inverse` | `#2d2b22` | `#E1DDD4` | On accent backgrounds |

### Accents

| Token | Dark | Light | Description |
|-------|------|-------|-------------|
| `--accent` | `#d8a657` | `#8a6b20` | Primary gold/amber |
| `--accent-hover` | `#e8b86a` | `#7a5c1f` | Hover state |
| `--accent-teal` | `#6ba3a0` | `#3d7a76` | Teal |
| `--accent-olive` | `#8b9a5e` | `#5c7030` | Olive |
| `--accent-brown` | `#a67c53` | `#7a5530` | Warm brown |
| `--accent-dark` | `#6e5c3e` | `#5c4420` | Dark earth |

### Semantic

| Token | Dark | Light | Description |
|-------|------|-------|-------------|
| `--success` | `#89b482` | `#2a6a2a` | Sage green |
| `--warn` | `#d8a657` | `#8a5c10` | Amber |
| `--danger` | `#ef8a83` | `#b03030` | Muted red |

### Syntax Highlighting

| Token | Dark | Light | Description |
|-------|------|-------|-------------|
| `--syntax-string` | `#a9b665` | `#2a6a2a` | String literals |
| `--syntax-keyword` | `#d3869b` | `#7a3070` | Keywords |
| `--syntax-function` | `#d8a657` | `#000` | Function names |
| `--syntax-comment` | `#9d8e7f` | `#444` | Comments |
| `--syntax-type` | `#89b482` | `#2a6a2a` | Type names |

### Typography

| Token | Value | Description |
|-------|-------|-------------|
| `--font` | `'Atkinson Hyperlegible', system-ui, sans-serif` | Body font |
| `--font-mono` | `ui-monospace, 'Cascadia Code', ...` | Monospace font |
| `--radius` | `0` | Border radius |
| `--text-xs` | `10px` | Extra small |
| `--text-sm` | `11px` | Small |
| `--text-base` | `13px` | Base |
| `--text-lg` | `15px` | Large |
| `--text-xl` | `18px` | Extra large |
| `--text-2xl` | `22px` | 2x large |
| `--text-3xl` | `28px` | 3x large |

### Motion

| Token | Value | Description |
|-------|-------|-------------|
| `--duration-fast` | `0.1s` | Quick transitions |
| `--duration-normal` | `0.2s` | Standard transitions |

### Terminal / Log

| Token | Dark | Light | Description |
|-------|------|-------|-------------|
| `--term-bg` | `#242219` | `#C9C8BD` | Terminal background |
| `--term-scrollbar` | `#5c5a4d` | `#999` | Scrollbar thumb |
| `--term-time` | `#9d9787` | `#555` | Timestamp text |
| `--term-text` | `#b5a993` | `#000` | Default log text |
| `--term-ok` | `#89b482` | `#2a6a2a` | OK/success text |
| `--term-warn` | `#d8a657` | `#8a5c10` | Warning text |
| `--term-err` | `#ea6962` | `#b03030` | Error text |

### Overlay / Canvas

| Token | Description |
|-------|-------------|
| `--overlay` | Modal/overlay backdrop |
| `--canvas-bg` | Canvas background |
| `--canvas-clear-bg` | Clear button background |
| `--canvas-clear-border` | Clear button border |
| `--canvas-clear-text` | Clear button text |
| `--canvas-clear-hover` | Clear button hover |

### Scrollbar

| Token | Dark | Light | Description |
|-------|------|-------|-------------|
| `--scrollbar-track` | `#3a3830` | `#E1DDD4` | Track background |
| `--scrollbar-thumb` | `#5c5a4d` | `#999` | Thumb colour |

---

## Icons

All icons are Font Awesome 6 Free classes wrapped in `<span class="icon">`. Requires Font Awesome 6 CSS.

Access via `UIKit.ICONS.<name>` or `UIKit.icon("<name>")`.

### App Controls

| Name | FA Class | Description |
|------|----------|-------------|
| `play` | `fa-solid fa-play` | Play |
| `pause` | `fa-solid fa-pause` | Pause |
| `stop` | `fa-solid fa-stop` | Stop |
| `refresh` | `fa-solid fa-arrows-rotate` | Refresh/reload |
| `spinner` | `fa-solid fa-spinner` | Animated spinner (has `.icon-spin`) |
| `save` | `fa-solid fa-floppy-disk` | Save |
| `close` | `fa-solid fa-xmark` | Close/dismiss |
| `plus` | `fa-solid fa-plus` | Add |
| `minus` | `fa-solid fa-minus` | Remove |
| `hamburger` | `fa-solid fa-bars` | Menu toggle |
| `chevron` | `fa-solid fa-chevron-right` | Drawer chevron |
| `gear` | `fa-solid fa-gear` | Settings |

### Theme

| Name | FA Class | Description |
|------|----------|-------------|
| `moon` | `fa-solid fa-moon` | Dark mode |
| `sun` | `fa-solid fa-sun` | Light mode |

### Contact / Social

| Name | FA Class | Description |
|------|----------|-------------|
| `mapMarker` | `fa-solid fa-location-dot` | Location |
| `graduationCap` | `fa-solid fa-graduation-cap` | Education |
| `envelope` | `fa-solid fa-envelope` | Email |
| `certificate` | `fa-solid fa-certificate` | Certificate |
| `download` | `fa-solid fa-download` | Download |
| `upload` | `fa-solid fa-upload` | Upload |
| `lock` | `fa-solid fa-lock` | Locked |
| `unlock` | `fa-solid fa-lock-open` | Unlocked |
| `brain` | `fa-solid fa-brain` | AI/ML |
| `github` | `fa-brands fa-github` | GitHub |
| `linkedin` | `fa-brands fa-linkedin` | LinkedIn |
| `calendar` | `fa-solid fa-calendar-plus` | Calendar/schedule |

### Media

| Name | FA Class | Description |
|------|----------|-------------|
| `video` | `fa-solid fa-video` | Video on |
| `videoOff` | `fa-solid fa-video-slash` | Video off |
| `microphone` | `fa-solid fa-microphone` | Mic on |
| `microphoneOff` | `fa-solid fa-microphone-slash` | Mic off |
| `wifi` | `fa-solid fa-wifi` | Network |

### Misc

| Name | FA Class | Description |
|------|----------|-------------|
| `externalLink` | `fa-solid fa-arrow-up-right-from-square` | External link |
| `copy` | `fa-regular fa-copy` | Copy |
| `edit` | `fa-solid fa-pen-to-square` | Edit |
| `trash` | `fa-solid fa-trash` | Delete |
| `search` | `fa-solid fa-magnifying-glass` | Search |
| `info` | `fa-solid fa-circle-info` | Information |
| `warning` | `fa-solid fa-triangle-exclamation` | Warning |
| `check` | `fa-solid fa-check` | Checkmark |
| `arrowLeft` | `fa-solid fa-arrow-left` | Left arrow |
| `arrowRight` | `fa-solid fa-arrow-right` | Right arrow |
| `star` | `fa-regular fa-star` | Star (outline) |
| `codeBranch` | `fa-solid fa-code-branch` | Git branch |

---

## Utility Classes

| Class | Description |
|-------|-------------|
| `.hidden` | `display: none !important` |
| `.sr-only` | Visually hidden, screen-reader accessible |
| `.resize-dragging` | Applied to `<body>` during drag-resize (disables selection) |

### Colour Helpers

| Class | Description |
|-------|-------------|
| `.acc-high` | Green (high accuracy) |
| `.acc-med` | Amber (medium accuracy) |
| `.acc-low` | Red (low accuracy) |
| `.conf-high` | Green (high confidence) |
| `.conf-low` | Muted (low confidence) |
| `.pred-label` | Bold accent-coloured label |
| `.text-ok` | Green text |
| `.text-warn` | Amber text |
| `.text-danger` | Red text |
| `.text-muted` | Muted text |
