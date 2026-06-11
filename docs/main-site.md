## Main Site (andypeterson.dev)

<a id="framework--core-configuration"></a>
### Framework & Core Configuration

| Property | Value |
|----------|-------|
| Framework | Astro 6.1.2 |
| Node Requirement | >= 22.0.0 |
| TypeScript Target | ES2022 (extends `astro/tsconfigs/strict`) |
| Domain | `andypeterson.dev` (CNAME) |
| Site URL | `process.env.SITE_URL \|\| 'https://andypeterson.dev'` |
| Dev Toolbar | Disabled |
| Integrations | `@astrojs/sitemap` |

**Astro Configuration Highlights (`astro.config.mjs`):**

- **Redirects:**
  - `/underconstruction.html` -> `/`
  - `/underconstruction` -> `/`
  - `/resume` -> `/`
- **Content Security Policy:** declared via the `security.csp` block (see the Security section below).
- **Sub-app delivery:** each sub-app's frontend is owned as static assets under `public/<app>/`
  (`public/nonogram/`, `public/classifiers/`, `public/video-chat/`, `public/cv/`) and embedded by
  the Astro pages in `src/pages/projects/**`. The former `serve-subprojects` dev middleware was
  removed (Phase E) — no path-rewriting glue remains.

**TypeScript Configuration (`tsconfig.json`):**
- Extends: `astro/tsconfigs/strict`
- Includes: `.astro/types.d.ts`, `src/**/*.*`, `tests/**/*`
- Excludes: `dist`, `node_modules`, `packages`

---

<a id="site-identity--configuration"></a>
### Site Identity & Configuration

**`src/config/site.ts`** exports a `SiteConfig` interface driven entirely by environment variables:

| Variable | Default | Field |
|----------|---------|-------|
| `SITE_DISPLAY_NAME` | `'Portfolio'` | `displayName`, `firstName`, `lastName` (derived) |
| `SITE_DOMAIN` | `'localhost'` | `domain` |
| `SITE_EMAIL` | `''` | `email` |
| `SITE_TITLE` | `'Portfolio'` | `title` |
| `SITE_DESCRIPTION` | `'Personal portfolio and project showcase'` | `description` |
| `SITE_GITHUB` | `''` | `github` |
| `SITE_LINKEDIN` | `''` | `linkedin` |

**`.env.example`** also documents optional variables:
- `PLAUSIBLE_DOMAIN` — analytics domain
- `PREVIEW_DEPLOY` — if `"true"`, adds `noindex` meta tag

---

<a id="project-registry"></a>
### Project Registry

**`src/data/projects.ts`** defines a `Project` interface and four project entries:

| Project | Slug | Category | App URL | Package Dir | Repo |
|---------|------|----------|---------|-------------|------|
| Quantum Video Chat | `quantum-video-chat` | — | external link-out (standalone app) | `qvc` | `Quantum-Interns-at-Qualcomm-Institiute/Quantum-Video-Chat` |
| Quantum Nonogram Solver | `quantum-nonogram-solver` | — | `/projects/quantum-nonogram-solver/app/` | `nonogram` | `Quantum-Interns-at-Qualcomm-Institiute/quantum-nonogram-solver` |
| Quantum ML Classifier Platform | `quantum-protein-kernel` | — | `/projects/quantum-protein-kernel/app/` | `quantum-protein-kernel` | `andypeterson2/quantum-machine-learning` |
| LaTeX Resume Editor | `latex-resume-editor` | — | `/projects/latex-resume-editor/app/` | `cv` | `andypeterson2/cv` |

All four are marked `active` and `featured`. Each has a custom icon, description, longDescription, and optional screenshots and appLinks arrays.

**`site-manifest.json`** is auto-generated (`scripts/generate-manifest.py`) and catalogs the portal's app entry points with metadata (icon, backend port). It is a generated artifact, not the runtime port source — each page's `<meta name="site-backend" data-port>` is the authored default.

---

<a id="pages--routing"></a>
### Pages & Routing

**`src/pages/` directory:**

| File | Purpose |
|------|---------|
| `index.astro` | Home page — greeting, tagline, featured projects in finder-icon grid, CTA |
| `about.astro` | Bio section with headshot, education/skills/experience windows, timeline, contact buttons |
| `projects/index.astro` | All projects in finder-icon grid layout |
| `projects/[slug].astro` | Dynamic project detail — hero section, launch/source buttons, screenshot carousel with auto-rotation, README rendering from `packageDir`, responsive float layout |
| `404.astro` | Quantum-themed error page with system.css window styling ("Lost in the superposition"), error action links |
| `projects/latex-resume-editor/app.astro` | App wrapper (iframe/embed) |
| `projects/quantum-nonogram-solver/app.astro` | App wrapper |
| `projects/quantum-protein-kernel/app.astro` | App wrapper |
| `projects/quantum-video-chat/client.astro` | App wrapper |
| `projects/quantum-video-chat/server.astro` | App wrapper |
| `classifiers/index.astro` | App wrapper |

---

<a id="components"></a>
### Components

**`src/components/`:**

| Component | Props | Behavior |
|-----------|-------|----------|
| `Button.astro` | `variant` (`primary`/`secondary`/`ghost`), `size` (`sm`/`md`/`lg`), `href?`, `class?` | Renders `<a>` if `href`, `<button>` otherwise. Uses system.css btn classes. |
| `SectionLabel.astro` | `label`, `class?` | Decorative horizontal line with centered label text. |
| `PullQuote.astro` | `cite?` | Blockquote with left/top/bottom borders, monospace citation, italicized body. |
| `ClassifierApp.astro` | — | Full ML classifier UI: split layout with train/models/saved on left, draw canvas or tabular predictor on right, chart area below. Loads `connection.js`, `sse.js`, `chart.js`, `app.js`. |
| `ServerConnectModal.astro` | — | Vanilla JS IIFE: detects `<meta name="site-backend">` tags, injects nav items with status dots, renders connection modals per service. Dispatches `navbar:connect`/`navbar:disconnect` custom events. Exports `widget.getUrl()` and `widget.setStatus()`. |

---

<a id="layouts"></a>
### Layouts

**`src/layouts/BaseLayout.astro`:**

| Feature | Detail |
|---------|--------|
| Props | `title`, `description`, `ogImage`, `breadcrumbs` (custom override) |
| Head | Meta tags, CSP via `<meta>`, Open Graph, Twitter Card, structured data (Person schema), Plausible analytics |
| Skip link | Hidden by default, shown on `:focus` |
| Desktop nav (>768px) | Menubar with heart-icon home link, About, Projects links |
| Mobile nav (<=768px) | Heart icon + `<select>` dropdown |
| Window structure | Title bar with `<h1>`, details bar with breadcrumb trail, main pane with `<slot>` |
| Back-to-top | Fixed button, visible after 400px scroll |
| Breadcrumbs | Auto-generated from `pathname` unless custom provided |
| Responsive | Switches layout at 768px, removes border/radius on mobile |

---

<a id="design-tokens--styling"></a>
### Design Tokens & Styling

**`src/styles/tokens.css`** — CSS custom properties on `:root`:

| Category | Tokens |
|----------|--------|
| Colors (monochrome) | `--color-bg`, `--color-surface`, `--color-text`, `--color-accent`, `--color-success`, `--color-warn`, `--color-danger`, `--color-text-muted`, `--color-text-inverse`, `--color-accent-hover` (all black/white/gray) |
| Fonts | `--font-sans` (Geneva), `--font-ui` (Chicago), `--font-mono` (Monaco) |
| Patterns | `--pattern-checker`, `--pattern-light`, `--pattern-diagonal` |
| Font sizes | `--text-xs` through `--text-4xl` (fixed values, no `clamp()`) |
| Spacing | `--space-1` through `--space-32` (0.25rem to 8rem, multiples of 0.25rem) |
| Shadows | `--shadow-focus` (2px 2px 0 #000) |
| Layout | `--max-width` (66.25rem), `--content-width` (42.5rem) |
| Line heights | `--leading-tight`, `--leading-normal`, `--leading-relaxed` |
| Tracking | `--tracking-tight`, `--tracking-normal`, `--tracking-wide` |
| Motion | `@media (prefers-reduced-motion: reduce)` disables all animations |

**`src/styles/base.css`** — Global resets and utilities:
- `box-sizing: border-box` universally
- Body: `--font-sans`, 16px, line-height 1.5, black on white
- Typography: H1-H6 sized from `--text-4xl` downward, `--font-sans`
- Links: color inherit, underline on hover (inverted bg)
- Code: monospace, inline padding/border, #eee background
- Utilities: `.sr-only`, `.container` (max-width centered), `.separator` (border-top)
- Section rule: flex with horizontal lines flanking text
- Icon grid: CSS Grid with auto-fill, `clamp()` sizing (100px-180px min)
- Finder icons: flex column, hover inverts icon and highlights label
- Selection: black background, white text
- Print: removes backgrounds, shows URLs after links, hides nav/buttons

**`DESIGN_SYSTEM.md`** — Canonical design rules:
- `tokens.css` is the single source of truth
- No raw hex values (use `--color-*` tokens)
- Pure monochrome: black, white, grays only; color never carries meaning alone
- All spacing in multiples of 4px (use `--space-*` tokens)
- Border radius: 0px (structural), 2px (interactive), 3px (system UI), 50% (avatars only)
- Typography: Geneva (body/headings), Chicago (chrome only), Monaco (mono, max `--text-sm`)
- Use design system `<Button>`, `<Card>`, `<CodeBlock>` over raw HTML
- 48px minimum touch targets
- `aria-label` for unlabeled elements
- Test in light and dark modes
- Use Astro `<Image>` from `astro:assets`, never raw `<img>`
- Descriptive alt text (no "image of" prefix), lazy loading by default
- Shadows: nav bar only (`0 1px 3px rgba(0,0,0,0.06)`), modals (`0 4px 16px rgba(0,0,0,0.10)`), nothing else

---

<a id="security"></a>
### Security

**Content Security Policy (via `astro.config.mjs` security block):**

| Directive | Sources |
|-----------|---------|
| `script-src` | `'self'`, `cdn.socket.io`, `unpkg.com`, `plausible.io`, `cdn.jsdelivr.net` |
| `style-src` | `'self'`, `unpkg.com`, `cdn.jsdelivr.net` |
| `default-src` | `'self'` |
| `font-src` | `'self'`, `unpkg.com`, `cdn.jsdelivr.net` |
| `img-src` | `'self'`, `data:` |
| `connect-src` | `'self'`, `plausible.io` (+ `http://localhost:*`, `ws://localhost:*`, `wss://localhost:*` in dev only) |
| `object-src` | `'none'` |
| `base-uri` | `'self'` |
| `form-action` | `'self'`, `mailto:` |
| `frame-ancestors` | `'none'` |

**`public/_headers`** (applied to all paths):

| Header | Value |
|--------|-------|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `X-XSS-Protection` | `0` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(self), microphone=(self), geolocation=()` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |

**`scripts/check-name-leakage.sh`:**
- Reads `PROTECTED_NAMES` env var (comma-separated)
- Scans `src/` recursively for hardcoded names in `.ts`, `.tsx`, `.astro`, `.mdx`, `.css` files
- Reports findings with file paths, suggests using `site.config.ts` variables instead

---

<a id="seo--analytics"></a>
### SEO & Analytics

- **Sitemap:** auto-generated via `@astrojs/sitemap`
- **robots.txt:** `User-agent: * / Allow: /`
- **Plausible Analytics:** loaded in `BaseLayout.astro` head
- **Open Graph & Twitter Card:** meta tags in layout
- **Structured Data:** Person schema (JSON-LD) in layout
- **Canonical URL:** set per page
- **Favicon:** in `public/`

---

<a id="scripts--tooling"></a>
### Scripts & Tooling

| Script | Purpose |
|--------|---------|
| `scripts/generate-manifest.py` | Scans all `index.html` files recursively, extracts `<meta>` tags (`site-nav-label`, `site-nav-icon`, `site-nav-pin`, `site-backend`), falls back to `<title>`, generates `site-manifest.json`. Excludes dockerfiles, images, lib, nginx, shared, tests, documents, node_modules, dist, templates. Skips Jinja templates. |
| `scripts/eslint-plugin-design-system.js` | Custom ESLint plugin with two rules: `prefer-button` (warns when `<button>` used instead of `<Button>` component) and `prefer-tag` (warns when `<span class="tag">` used instead of `<Tag>` component). Both skip `src/components/`. |
| `scripts/new-page.sh` | Takes `page-name` arg, creates `src/pages/${SLUG}.astro` from template with `BaseLayout`, page sections, and responsive CSS. |
| `scripts/serve.py` | Python `SimpleHTTPRequestHandler` with `Cache-Control: no-store` headers. Port 8000 default, configurable via arg. |

---

<a id="testing"></a>
### Testing

**Unit & Component Tests (Vitest):**

| Config | Value |
|--------|-------|
| Config file | `vitest.config.ts` |
| Pattern | `tests/**/*.test.ts` |
| Coverage provider | v8 |
| Coverage includes | `src/**/*.{ts,astro}` |
| Coverage excludes | `src/env.d.ts` |
| Coverage reporters | text, html |

Test files in `tests/`:

| File | Coverage |
|------|----------|
| `pages.test.ts` | Nav ARIA, system.css patterns, page existence, skip-to-content, window structure, home/project links, accessibility (prefers-reduced-motion, ARIA), SEO (meta description, viewport, OG, Twitter Card, canonical, favicon), security headers |
| `tokens.test.ts` | Token CSS `:root` monochrome variables, no light theme overrides, prefers-reduced-motion, spacing tokens, fixed font sizes, base CSS resets, component existence/props |
| `blog.test.ts` | 404 quantum-themed messaging, navigation suggestions, system.css window |
| `project-detail.test.ts` | Project detail rendering |
| `deployment.test.ts` | Deployment validation |
| `privacy-seo.test.ts` | Privacy and SEO compliance |
| `qa-testing.test.ts` | QA test suite |
| `phase5-polish.test.ts` | Polish phase tests |

**E2E Tests (Playwright):**

| Config | Value |
|--------|-------|
| Config file | `playwright.config.ts` |
| Test directory | `tests/e2e/` |
| Browser | Chromium only (Desktop Chrome) |
| Base URL | `http://localhost:4321` |
| Parallel | Enabled |
| Retries | 1 in CI, 0 locally |
| Workers | 1 in CI, unlimited locally |
| Trace | On first retry |
| Web server | `npm run dev` on port 4321, reuses existing |

E2E spec files:

| Spec | Coverage |
|------|----------|
| `navigation.spec.ts` | Home renders with title/featured projects, desktop menubar links, breadcrumbs, heart icon, back-to-top button |
| `pages.spec.ts` | Core pages render without errors, 404 content, project index lists finder icons (>=3), icon links, about page sections |
| `responsive.spec.ts` | Responsive layout tests |
| `qvc-client.spec.ts` | QVC client tests |
| `server-connect.spec.ts` | Server connection modal tests |

**Contract Tests (Python):** each backend now owns its own contract test in its repo
(`tests/contract/test_<service>_api.py`), run by that app's CI against a booted backend.
The portal keeps the canonical schemas (`docs/api-contract/schemas/`) and validates them
in the `contract-schemas` CI job.

**Smoke Tests (Python, `tests/smoke/`):**
- `test_docker_services.py` — Docker container health checks

**Lighthouse CI:**

| Config | Form Factor | CPU Slowdown |
|--------|-------------|--------------|
| `.lighthouserc.json` | Desktop | None (screen emulation disabled) |
| `.lighthouserc.mobile.json` | Mobile | 4x multiplier |

Both configs test URLs: `/`, `/projects/`, `/projects/latex-resume-editor/app/`

| Assertion | Threshold |
|-----------|-----------|
| Performance | warn at 0.5 |
| Accessibility | error at 0.85 |
| Best Practices | error at 0.85 |
| SEO | error at 1.0 |

---

<a id="cicd-pipelines"></a>
### CI/CD Pipelines

**`.github/workflows/ci.yml`** — Continuous Integration (portal-only; each sub-app has its own CI in its own repo):

Triggers: push to `main`, pull requests.

**Job 1: `astro-build`** (Node 22)
- `npm ci`, `npm audit --audit-level=high`, `npm run lint`, name-leakage check (`scripts/check-name-leakage.sh`), `npm test -- --coverage`, `npm run build`
- Uploads `coverage/` and `dist/` as artifacts

**Job 2: `e2e-tests`** (Node 22, needs `astro-build`)
- Installs Playwright Chromium, downloads the `dist/` artifact, runs `npx playwright test` (PR runs are Chromium-only; firefox/webkit in full sweeps)

**Job 3: `contract-schemas`** (Python 3.12)
- Validates every `docs/api-contract/schemas/*.json` is a well-formed JSON Schema (`jsonschema` Draft 2020-12). The live-HTTP contract tests live in each app's own repo.

**Job 4: `lighthouse-desktop`** (needs `astro-build`)
- `treosh/lighthouse-ci-action@v12` against the built `dist/` with `.lighthouserc.json`

**Job 5: `lighthouse-mobile`** (needs `astro-build`)
- Same, with `.lighthouserc.mobile.json`

**`.github/workflows/codeql.yml`** — CodeQL static analysis (`analyze` job) on a language matrix.

---

**`.github/workflows/deploy.yml`** — GitHub Pages Deployment:

Triggers: `workflow_run` after the **CI** workflow completes on `main` (deploys only when CI passed), plus manual `workflow_dispatch`.

| Step | Action |
|------|--------|
| Checkout | The CI-validated commit (`workflow_run.head_sha`); no submodules |
| Setup Node | v22, npm caching |
| Build | `npm ci && npm run build` |
| Upload | `dist/` via `actions/upload-pages-artifact@v3` |
| Deploy | `actions/deploy-pages@v4` |

Permissions: `pages: write`, `id-token: write`, `contents: read`

---

**`.github/workflows/generate-manifest.yml`** — Auto-manifest:

Triggers: push to `main` (ignoring `site-manifest.json` changes).

| Step | Action |
|------|--------|
| Setup Python | 3.12 |
| Generate | `python3 scripts/generate-manifest.py` |
| Commit | If changed, commits as `github-actions[bot]` |

---

<a id="deployment"></a>
### Deployment

- **Platform:** GitHub Pages
- **Output:** Static site in `dist/` from `astro build`
- **Domain:** `andypeterson.dev` (CNAME)
- **Artifact upload:** `actions/upload-pages-artifact` + `actions/deploy-pages`
- **Environment:** `github-pages`

---

<a id="docker--local-development"></a>
### Docker & Local Development

**`docker-compose.yml`** (root) defines only the portal dev container — backends are no longer in this repo; run each app from its own clone and point the portal at it with `?backend=…`.

**Website service (dev profile only):**

| Property | Value |
|----------|-------|
| Image | `node:22-slim` |
| Command | `sh -c "npm install && npx astro dev --host 0.0.0.0 --port ${ASTRO_PORT}"` |
| Port | `127.0.0.1:${ASTRO_PORT}:${ASTRO_PORT}` |
| Environment | `SITE_URL="http://localhost:${ASTRO_PORT}"` |
| Volumes | `.:/app`, `website_node_modules:/app/node_modules` |

**Service Ports (from `DEVELOPMENT.md`):**

| Service | Default Port |
|---------|-------------|
| Astro dev server | 4321 |
| Classifiers (QPK) | 5001 |
| CV Editor | 3001 |
| Nonogram | 5055 |
| Video Chat Server | 5050 |
| Video Chat Client A | 5002 |

**URL Resolution Priority Chain:** URL params -> unified `?backend=` param -> localStorage -> defaults

**No submodules:** the portal is standalone — each app lives in its own repo and is consumed only as an HTTP API (its built frontend is owned under `public/<app>/`).

---

<a id="makefile"></a>
### Makefile

| Target | Description |
|--------|-------------|
| `make setup` | Install dependencies (`npm ci`; requires Node ≥22) |
| `make install` | `npm ci` |
| `make test` | Unit tests (vitest) |
| `make test-e2e` | End-to-end tests (playwright) |
| `make lint` | eslint + prettier + stylelint |
| `make build` | Build the Astro site |
| `make docker-build` | Build the portal Docker image |
| `make docker-up` | Start the portal dev container (profile: dev) |
| `make docker-down` | Stop containers |
| `make clean` | Remove `dist`/`.astro` |

---

<a id="linting--formatting"></a>
### Linting & Formatting

| Tool | Version | Scope |
|------|---------|-------|
| ESLint | 10.1.0 | TypeScript, TSX, Astro files |
| Prettier | 3.8.1 | TypeScript, TSX, Astro, CSS |
| Stylelint | 17.5.0 | CSS, Astro files |
| Ruff | latest | Python (`scripts/`, `tests/smoke/`) |

**ESLint Configuration (`eslint.config.js`):**
- Uses `eslint-plugin-astro` (recommended config)
- TypeScript ESLint parser
- Custom design-system plugin from `scripts/`
- Rules: `no-unused-vars` (warn, ignoring `_` prefix), `no-explicit-any` (warn)
- Design system: `prefer-button` (warn) for `.astro` pages/layouts

**Python Configuration (`pyproject.toml`):**
- Target: Python 3.12
- Line length: 100
- Ruff select: E, W, F, I, N, UP, B, S, T20, SIM, RUF
- Per-file ignores: tests may ignore S101, S108, S603, S607, S310
- MyPy: `python_version = "3.12"`, `warn_return_any`, `check_untyped_defs`
- Pytest: `testpaths = ["tests"]`, `timeout = 300`

---

<a id="cv-editor"></a>
