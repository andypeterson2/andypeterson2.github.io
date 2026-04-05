# Portfolio Website — Comprehensive Technical Overview

## Table of Contents

- [Main Site (andypeterson.dev)](#main-site)
  - [Framework & Core Configuration](#framework--core-configuration)
  - [Site Identity & Configuration](#site-identity--configuration)
  - [Project Registry](#project-registry)
  - [Pages & Routing](#pages--routing)
  - [Components](#components)
  - [Layouts](#layouts)
  - [Design Tokens & Styling](#design-tokens--styling)
  - [Security](#security)
  - [SEO & Analytics](#seo--analytics)
  - [Scripts & Tooling](#scripts--tooling)
  - [Testing](#testing)
  - [CI/CD Pipelines](#cicd-pipelines)
  - [Deployment](#deployment)
  - [Docker & Local Development](#docker--local-development)
  - [Makefile](#makefile)
  - [Linting & Formatting](#linting--formatting)
- [CV Editor](#cv-editor)
  - [Overview](#cv-overview)
  - [Server Architecture](#cv-server-architecture)
  - [Database Layer](#cv-database-layer)
  - [Database Schema](#cv-database-schema)
  - [Schema Validation](#cv-schema-validation)
  - [LaTeX Serialization](#cv-latex-serialization)
  - [LaTeX Parsing](#cv-latex-parsing)
  - [LaTeX Generation Orchestrator](#cv-latex-generation-orchestrator)
  - [Frontend](#cv-frontend)
  - [Testing](#cv-testing)
  - [Docker](#cv-docker)
  - [CI/CD](#cv-cicd)
  - [Environment Variables](#cv-environment-variables)
  - [Architectural Patterns](#cv-architectural-patterns)
  - [Dependencies](#cv-dependencies)
- [Nonogram Solver](#nonogram-solver)
  - [Overview](#nonogram-overview)
  - [Core Python Package](#nonogram-core-python-package)
  - [Flask Backend](#nonogram-flask-backend)
  - [Frontend](#nonogram-frontend)
  - [Testing](#nonogram-testing)
  - [CI/CD](#nonogram-cicd)
  - [Docker](#nonogram-docker)
  - [Performance Baselines](#nonogram-performance-baselines)
  - [Dependencies](#nonogram-dependencies)
- [Quantum Protein Kernel](#quantum-protein-kernel)
  - [Overview](#qpk-overview)
  - [Core Abstractions](#qpk-core-abstractions)
  - [Dataset Plugins](#qpk-dataset-plugins)
  - [Training, Evaluation, Prediction](#qpk-training-evaluation-prediction)
  - [Model Registry & Persistence](#qpk-model-registry--persistence)
  - [REST API & Routes](#qpk-rest-api--routes)
  - [Special Layers & Loss Functions](#qpk-special-layers--loss-functions)
  - [Frontend](#qpk-frontend)
  - [Testing](#qpk-testing)
  - [CI/CD](#qpk-cicd)
  - [Docker](#qpk-docker)
  - [Dependencies](#qpk-dependencies)
  - [Architectural Patterns](#qpk-architectural-patterns)
- [Quantum Video Chat (QVC)](#quantum-video-chat-qvc)
  - [Overview](#qvc-overview)
  - [Signaling Server](#qvc-signaling-server)
  - [Room Management](#qvc-room-management)
  - [Frontend Application](#qvc-frontend-application)
  - [WebRTC Management](#qvc-webrtc-management)
  - [Cryptography](#qvc-cryptography)
  - [BB84 Quantum Key Distribution](#qvc-bb84-quantum-key-distribution)
  - [Simulated Quantum Channel](#qvc-simulated-quantum-channel)
  - [Metrics Collection](#qvc-metrics-collection)
  - [Testing](#qvc-testing)
  - [CI/CD](#qvc-cicd)
  - [Docker](#qvc-docker)
  - [Dependencies](#qvc-dependencies)

---

## Quantum Algorithm Glossary

Brief summaries of the quantum algorithms used across this portfolio:

**BB84 Quantum Key Distribution** -- A protocol for two parties (Alice and Bob) to generate a shared secret key using quantum mechanics. Alice sends photons polarized in random bases; Bob measures in random bases. They publicly compare bases (not results), keep only matching measurements, then perform error correction and privacy amplification. An eavesdropper disturbs the quantum states, raising the quantum bit error rate (QBER) above a detectable threshold (~11%).

**Grover's Algorithm** -- A quantum search algorithm that finds a marked item in an unsorted database of N items in O(sqrt(N)) steps, versus O(N) classically. In this project it solves nonogram puzzles by searching the solution space of valid grid configurations. An oracle marks correct solutions; amplitude amplification increases their measurement probability.

**Quantum Kernels** -- A technique in quantum machine learning where classical data is mapped into a high-dimensional quantum feature space via parameterized circuits. The kernel (inner product of quantum states) captures complex relationships that are hard to compute classically. Used here for protein sequence classification with hybrid quantum-classical models combining quantum feature maps with classical SVMs/neural networks.

---

<a id="main-site"></a>
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
- **Custom Vite Plugin (`serve-subprojects`):**
  - Dev middleware that serves sub-project static directories at their expected paths: `/nonogram/`, `/classifiers/`, `/cv/`, `/qvc/`, `/packages/`, `/lib/`, `/shared/`, `/site-manifest.json`
  - Handles path rewriting for legacy routes (e.g. `/classifiers/` -> `/packages/quantum-protein-kernel/classifiers/`)
  - Serves `index.html` for directory requests
  - Sets MIME types for `.html`, `.css`, `.js`, `.mjs`, `.json`, `.png`, `.jpg`, `.svg`, `.ico`, `.woff`, `.woff2`, `.ttf`

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
| Quantum Video Chat | `quantum-video-chat` | — | `/projects/quantum-video-chat/client/` + `/server/` | `qvc` | `Quantum-Interns-at-Qualcomm-Institiute/Quantum-Video-Chat` |
| Quantum Nonogram Solver | `quantum-nonogram-solver` | — | `/projects/quantum-nonogram-solver/app/` | `nonogram` | `Quantum-Interns-at-Qualcomm-Institiute/quantum-nonogram-solver` |
| Quantum ML Classifier Platform | `quantum-protein-kernel` | — | `/projects/quantum-protein-kernel/app/` | `quantum-protein-kernel` | `andypeterson2/quantum-machine-learning` |
| LaTeX Resume Editor | `latex-resume-editor` | — | `/projects/latex-resume-editor/app/` | `cv` | `andypeterson2/cv` |

All four are marked `active` and `featured`. Each has a custom icon, description, longDescription, and optional screenshots and appLinks arrays.

**`site-manifest.json`** is auto-generated and registers sub-apps with metadata:
- CV Editor (`/packages/cv/website/`, pen-to-square icon, backend port 3000)
- Nonogram (`/packages/nonogram/website/`, puzzle-piece icon, backend port 5055)
- QKD Video Chat (`/packages/qvc/website/client/`)

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
| `style-src` | `'self'`, `'unsafe-inline'`, `unpkg.com` |
| `default-src` | `'self'` |
| `font-src` | `'self'`, `unpkg.com` |
| `img-src` | `'self'`, `data:` |
| `connect-src` | `'self'`, `ws:`, `wss:`, `localhost`, websocket |
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

**Contract Tests (Python, `tests/contracts/`):**

| File | Service |
|------|---------|
| `test_classifier_api.py` | Quantum protein classifier API response shapes |
| `test_cv_api.py` | CV editor backend API response shapes |
| `test_nonogram_api.py` | Nonogram API response shapes |
| `test_qvc_api.py` | Video chat API response shapes |
| `conftest.py` | Imports directly from backend packages, requires Python 3.10+ |

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

**`.github/workflows/ci.yml`** — Continuous Integration:

Triggers: push to `main`, pull requests.

**Job 1: `changes`**
- Uses `dorny/paths-filter` to detect which subprojects changed
- Filters: `website` (src/, astro.config, package.json, packages/shared-js/), `qpk`, `ui-kit`, `cv`

**Job 2: `astro-build`** (Node 22)
- Condition: website or ui-kit changed
- Steps: checkout (with submodules), `npm ci`, `npm run lint`, `npm test`, `npm run build`

**Job 3: `ui-kit-tests`** (Node 22)
- Condition: ui-kit changed
- Steps: `cd packages/ui-kit && npm ci && npx vitest run`

**Job 4: `cv-tests`** (Node 22)
- Condition: cv changed
- Steps: `cd packages/cv/editor && npm install && npm test`

**Job 5: `python-lint`** (Python 3.12)
- Condition: qpk changed
- Steps: `pip install ruff`, `ruff check packages/quantum-protein-kernel/classifiers`

**Job 6: `qpk-tests`** (Python 3.12)
- Condition: qpk changed
- Steps: installs CPU-only PyTorch + deps, runs pytest

**Job 7: `lighthouse-desktop`** (Node 22)
- Condition: website or ui-kit changed (runs after `astro-build`)
- Uses `treosh/lighthouse-ci-action@v12` with `.lighthouserc.json`

**Job 8: `lighthouse-mobile`** (Node 22)
- Same condition, uses `.lighthouserc.mobile.json`

**Job 9: `docker-build`**
- Condition: qpk changed
- Creates `.env` files, builds classifier Docker image

---

**`.github/workflows/deploy.yml`** — GitHub Pages Deployment:

Triggers: push to `main`, manual dispatch.

| Step | Action |
|------|--------|
| Checkout | Recursive submodules |
| Setup Node | v22, npm caching |
| Build | `npm ci && npm run build` |
| Upload | `dist/` as Pages artifact |
| Deploy | `actions/deploy-pages@v4` |

Permissions: `pages: write`, `id-token: write`

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

**`docker-compose.yml`** (root) includes sub-compose files:
- `packages/quantum-protein-kernel/docker-compose.yml`
- `packages/nonogram/docker-compose.yml`
- `packages/qvc/docker-compose.yml`
- `packages/cv/docker-compose.yml`

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
| CV Editor | 3000 |
| Nonogram | 5055 |
| Video Chat Server | 5050 |
| Video Chat Client A | 5002 |

**URL Resolution Priority Chain:** URL params -> unified `?backend=` param -> localStorage -> defaults

**Submodules:** 5 git submodules (cv, nonogram, quantum-protein-kernel, qvc, ui-kit)

---

<a id="makefile"></a>
### Makefile

| Target | Description |
|--------|-------------|
| `make setup` | Initialize git submodules + install all dependencies |
| `make install` | `npm ci` + pip install for all projects |
| `make test` | Run all tests (Python + JavaScript) |
| `make test-py` | Python tests via pytest |
| `make test-js` | JavaScript tests via npm/jest/vitest |
| `make lint` | Ruff + ESLint linting |
| `make lint-py` | Ruff on specific directories |
| `make lint-js` | ESLint (if configured) |
| `make build` | `astro build` |
| `make test-<project>` | Test a single project (generic pattern) |
| `make docker-build` | Build all Docker images |
| `make docker-up` | Start all services |
| `make docker-down` | Stop all services |
| `make clean` | Remove build artifacts and cache directories |

Project definitions:
- `PYTHON_PROJECTS`: `packages/quantum-protein-kernel`
- `JS_PROJECTS`: `packages/ui-kit`, `packages/cv/editor`, `packages/nonogram/website`, `packages/qvc`

---

<a id="linting--formatting"></a>
### Linting & Formatting

| Tool | Version | Scope |
|------|---------|-------|
| ESLint | 10.1.0 | TypeScript, TSX, Astro files |
| Prettier | 3.8.1 | TypeScript, TSX, Astro, CSS |
| Stylelint | 17.5.0 | CSS, Astro files |
| Ruff | latest | Python (quantum-protein-kernel, nonogram, qvc) |

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
## CV Editor

**Package location:** `packages/cv`

<a id="cv-overview"></a>
### Overview

Full-stack web application for managing LaTeX resumes, CVs, and cover letters with a browser-based editor and server-side PDF compilation. Features granular CRUD, three document variants (resume, CV, cover letter), drag-and-drop reordering, debounced autosave, multi-person profiles, JSON import/export, and a demo mode with a static Jane Doe dataset.

<a id="cv-server-architecture"></a>
### Server Architecture

**`editor/server.js`** (543 lines) — Express.js application:

| Property | Value |
|----------|-------|
| Framework | Express 4.21.0 |
| Database | SQLite via better-sqlite3 12.8.0 |
| Validation | AJV 8.18.0 (JSON Schema) |
| DB Path | `process.env.CV_DB_PATH` or `../cv.db` |
| Static Files | Served from `public/` |
| Testability | Exports app with `app.setDb()` and `app.getDb()` for DI |

**CORS Policy:** Hardcoded allowlist — localhost ports 3001, 4321, 4322, 8000 and `andypeterson2.github.io`.

**API Surface (grouped by resource):**

| Resource | Endpoints |
|----------|-----------|
| Settings | `GET/PATCH /api/settings` |
| Sections | `GET/POST /api/sections`, `GET/PUT/DELETE /api/sections/:id` |
| Entries | `POST /api/sections/:id/entries`, `PUT/DELETE /api/entries/:id`, `PATCH` order |
| Items | `POST /api/entries/:id/items`, `PUT/DELETE /api/items/:id`, `PATCH` order |
| Metrics | `GET/POST/PUT/DELETE /api/metrics[/:id]` |
| Documents | `GET/PUT /api/documents/:variant` (cv, resume, coverletter) |
| Cover Letter | `GET/POST/PUT/DELETE /api/coverletter/sections[/:id]`, `PATCH` order |
| Persons | `GET/POST/PUT/DELETE /api/persons[/:id]`, `POST` switch |
| Compilation | `POST /api/compile/:variant`, `GET /api/pdf/:variant` |
| Bulk | `POST /api/import`, `GET /api/export` |
| Health | `GET /api/health` |

**Compilation Pipeline:**
1. Receives variant (`cv`, `resume`, `coverletter`)
2. Calls `db.getAllForCompile(variant)` to gather all data
3. Calls `generateAll()` to write `.tex` files to `build/{variant}/`
4. Runs `fc-cache` to refresh font config
5. Executes `xelatex` with `--no-shell-escape`
6. Returns compilation status + log + PDF path

<a id="cv-database-layer"></a>
### Database Layer

**`editor/lib/db.js`** (738 lines) — `CvDatabase` class:

| Feature | Detail |
|---------|--------|
| Constructor | Takes `dbPath` (file path or `:memory:` for tests) |
| WAL mode | Enabled for concurrent reads |
| Foreign keys | Enforced |
| Migrations | Auto-run from `migrations/` directory |
| Seeding | Jane Doe demo data if no persons exist |
| Prepared statements | All queries use prepared statements (`_stmts` object) |

**Core method groups:**

| Group | Key Methods |
|-------|-------------|
| Settings | `getSettings(prefix)`, `setSettings(map)` (upsert transaction) |
| Sections | `getSections()`, `getSection(id)` (with nested entries+items), `createSection(id, type, title)`, `updateSection`, `deleteSection` (cascades) |
| Entries | `createEntry(sectionId, fields, resumeIncluded)`, `updateEntry`, `deleteEntry`, `reorderEntries(sectionId, ids)` (transaction) |
| Items | `createItem(entryId, content, resumeIncluded)`, `updateItem`, `deleteItem`, `reorderItems(entryId, ids)` |
| Metrics | `getMetrics(sectionId?)`, `createMetric({command, label, value, groupName, sectionId})` (UNIQUE command), `updateMetric`, `deleteMetric` |
| Documents | `getDocumentSections(variant)` (ordered + enable flags), `setDocumentSections(variant, sections)` (clear+reinsert transaction) |
| Cover Letter | `getCoverletterSections()`, `createCoverletterSection`, `updateCoverletterSection`, `deleteCoverletterSection`, `reorderCoverletterSections` |
| Persons | `getPersons()`, `getPerson(id)`, `createPerson(name, data)` (UNIQUE name), `renamePerson`, `deletePerson` (blocks active), `switchPerson(newId)` (atomic save+import) |
| Compound | `getAllForCompile(variant)` (filters by variant+enabled+resumeIncluded), `getAllForExport()`, `importAll(data)` (atomic clear+rebuild), `seedJaneDoe()` |

<a id="cv-database-schema"></a>
### Database Schema

**Migration `001_initial.sql`** (80 lines) — 7 core tables:

```
settings          (key PK, value)
sections          (id TEXT PK, type TEXT, title TEXT)
entries           (id AUTOINCREMENT, section_id FK CASCADE, sort_order, fields JSON, resume_included)
items             (id AUTOINCREMENT, entry_id FK CASCADE, sort_order, content, resume_included)
metrics           (id AUTOINCREMENT, command UNIQUE, label, value, group_name, section_id FK CASCADE)
document_sections (id AUTOINCREMENT, variant, section_id FK, enabled, sort_order, resume_paragraph_text, UNIQUE(variant, section_id))
coverletter_sections (id AUTOINCREMENT, sort_order, title, body)
```

**Migration `002_persons.sql`:**

```
persons           (id AUTOINCREMENT, name UNIQUE, data JSON, created_at DEFAULT CURRENT_TIMESTAMP)
```

4 indexes covering common query patterns (section/entry, entry/item, metrics/section, document variants).

Section types: `cventries`, `cvskills`, `cvhonors`, `cvreferences`, `cvparagraph`.

<a id="cv-schema-validation"></a>
### Schema Validation

**`editor/lib/schema.js`** (311 lines) — AJV-compiled validators:

| Schema | Validation Rules |
|--------|-----------------|
| Settings | Object with string keys matching `^[a-zA-Z0-9_.]+$`, string values |
| Sections | `id` (1-100 chars, `^[a-z0-9_-]+$`), `type` (enum), `title` (max 200) |
| Entries | `fields` (object), `resumeIncluded` (boolean) |
| Items | `content` (string), `resumeIncluded` (boolean) |
| Reorder | `ids` (array of integers, min 1, unique) |
| Metrics | `command` (`^[a-zA-Z]+$`, max 100), `label`, `value`, `groupName`, `sectionId` |
| Document sections | Array of `{sectionId, enabled?, resumeParagraphText?}` |
| Cover letter sections | `title` (max 200), `body` (string) |
| Persons | `name` (1-200 chars) |
| Import data | `{personal, sections}` required, `{metrics, documents, coverletter}` optional |

Middleware: `validate(schemaName)` returns 400 with error details on failure.

<a id="cv-latex-serialization"></a>
### LaTeX Serialization

**`editor/lib/serializer.js`** (461 lines):

**`escTex(str)`** — escapes LaTeX specials (`& % $ # _ ~ ^`) while preserving intentional commands like `\textbf{...}`.

**Section serializers (type-specific):**

| Type | LaTeX Output |
|------|-------------|
| `cventries` | `\begin{cventries}...\end{cventries}` with `\cventry{position}{org}{location}{date}{items}` |
| `cvskills` | `\begin{cvskills}...\end{cvskills}` with `\cvskill{category}{skills}` |
| `cvhonors` | `\begin{cvhonors}...\end{cvhonors}` with `\cvhonor{award}{issuer}{location}{date}` |
| `cvreferences` | `\begin{cvreferences}...\end{cvreferences}` with `\cvreference{name}{relation}{phone}{email}` |
| `cvparagraph` | `\begin{cvparagraph}...\end{cvparagraph}` with raw text content |

**Data serialization (`serializeData`):** Generates `data.tex` with photo command, `\name{first}{last}`, `\position{...}`, contact info, social links, and grouped metrics via `\providecommand{\cmdName}{value}` (or `\tbd{label}` if null).

**Document generators:** Builds LaTeX preamble with documentclass, geometry, accent color, font settings. Supports custom hex colors or preset awesome-cv colors. Supports Roboto or Source Sans 3 font families. Cover letter specific: recipient, title, opening, closing, enclosures.

<a id="cv-latex-parsing"></a>
### LaTeX Parsing

**`editor/lib/parser.js`** (328 lines) — Reverse-engineering functions for import workflows:

| Function | Purpose |
|----------|---------|
| `detectSectionType(tex)` | Regex-based type detection (`\begin{cventries}`, etc.) |
| `parseCventries(tex)` | Extracts `\cventry{...}` and nested `\item{...}` bullets |
| `parseCvskills(tex)` | Extracts `\cvskill{category}{skills}` |
| `parseCvhonors(tex)` | Extracts `\cvhonor{award}{issuer}{location}{date}` |
| `parseCvreferences(tex)` | Extracts `\cvreference{name}{relation}{phone}{email}` |
| `parseCvparagraph(tex)` | Extracts text between `\begin/\end{cvparagraph}` |
| `parseDocument(tex)` | Extracts `\input{file.tex}` and commented-out lines for section ordering |
| `parseData(tex)` | Extracts personal info from `\name`, `\position`, contacts, and metrics from `\providecommand` |
| `parseCoverletter(tex)` | Extracts recipient, title, opening, closing, enclosures, and letter sections |

**`editor/lib/braceExtractor.js`** (83 lines) — Brace-aware utilities:
- `extractBraceArgs(text, startIndex, count)` — Finds and extracts N top-level brace groups, handles nesting, ignores escaped braces
- `findCommand(text, commandName, argCount)` — Finds all `\commandName` occurrences and extracts their arguments

<a id="cv-latex-generation-orchestrator"></a>
### LaTeX Generation Orchestrator

**`editor/lib/generator.js`** (295 lines):

`generateAll(compileData, buildDir, templatesDir, assetsDir)`:
1. Ensure build directory exists
2. Copy template files (awesome-cv.cls, fontawesome6.sty, fonts, etc.)
3. Copy assets directory (profile photos)
4. Generate `data.tex` via serializer
5. For coverletter: generate `coverletter.tex`, return path
6. For cv/resume: generate per-section `.tex` files + main document `.tex` with `\input{}` statements

**Style defaults:**

| Setting | Default |
|---------|---------|
| Page size | `letterpaper` |
| Font size | `11pt` |
| Accent color | `spinel` |
| Font family | `source-sans-3` |

Preset accent colors: awesome-emerald, awesome-skyblue, awesome-red, awesome-pink, awesome-orange, awesome-nephritis, awesome-concrete, awesome-darknight, spinel.

<a id="cv-frontend"></a>
### Frontend

**Location:** `editor/public/` — `index.html` (800+ lines), `app.js` (1000+ lines), `style.css`

**Framework:** Alpine.js 3.14.8 (CDN) + SortableJS 1.15.0 (CDN)

**Alpine.js data model:**

| Field | Type | Purpose |
|-------|------|---------|
| `editorTab` | `'sections' \| 'profile' \| 'coverletter' \| 'style'` | Active editor tab |
| `pdfTab` | `'cv' \| 'resume' \| 'coverletter'` | Active PDF preview tab |
| `sections` | array | Section definitions |
| `docSections` | array | Variant-specific section ordering |
| `personal` | object | Personal info fields |
| `metrics` | array | LaTeX metrics |
| `coverletter` | object | Cover letter settings + sections |
| `style` | object | Page size, font size, accent color, font family |
| `compiling` | boolean | Compilation in progress |
| `compiledPdfs` | object | PDF URLs per variant |
| `persons` | array | Multi-person list |
| `activePersonId` | number | Current person |
| `modal` | object | Modal system (open, title, fields, resolve) |
| `_saveTimers` | object | Debounce timers (500ms) |

**UI tabs:**
1. **Profile** — firstName, lastName, email, GitHub, LinkedIn, photo toggle
2. **Sections** — Section list with drag handles, expand/collapse entries, add/remove entries/items, resume toggles
3. **Cover Letter** — Recipient/title/opening/closing/enclosure fields, letter sections
4. **Style** — Page size, font size, accent color (preset or custom hex), font family

**External CDN dependencies:** Alpine.js, SortableJS, Font Awesome 6.5.1, Google Fonts (Atkinson Hyperlegible)

<a id="cv-testing"></a>
### Testing

**Test runner:** Vitest 4.1.2 | **Config:** `vitest.config.js` with globals enabled | **Total: 525+ tests**

| Suite | File | Approx Tests | Scope |
|-------|------|-------------|-------|
| Unit | `unit/db.test.js` | ~200 | All CvDatabase methods |
| Unit | `unit/serializer.test.js` | — | JSON -> LaTeX roundtrip |
| Unit | `unit/parser.test.js` | — | LaTeX parsing for all section types |
| Unit | `unit/schema.test.js` | — | AJV validation schemas |
| Unit | `unit/generator.test.js` | — | .tex file generation pipeline |
| Unit | `unit/braceExtractor.test.js` | — | Brace extraction utilities |
| Unit | `unit/cors.test.js` | — | CORS middleware validation |
| Integration | `integration/workflows.test.js` | — | Full API lifecycle, resume filtering, compilation, multi-person switching |
| Integration | `test_phase1_template.test.js` | — | Advanced template scenarios |
| Integration | `test_phase2_crosscutting.test.js` | — | Cross-cutting concerns |
| DOM | `tests/dom/` (7 files) | — | Alpine.js component interactions via happy-dom, modal system, forms |

Test database uses `:memory:` SQLite for isolation. Test helpers: in-memory DB creation per test, seeding functions, HTTP request helper, test server startup/teardown.

<a id="cv-docker"></a>
### Docker

**Dockerfile (46 lines):**

| Layer | Purpose |
|-------|---------|
| Base | `node:20-slim` |
| System packages | `texlive-xetex`, `texlive-fonts-extra`, `texlive-fonts-recommended`, `fontconfig` |
| Fonts | Source Sans 3 OTF (GitHub releases), Roboto TTF (Google Fonts releases) |
| Font config | `/etc/fonts/conf.d/99-app-fonts.conf` includes `/app/build` and `/app/templates` |
| Cleanup | Removes curl/unzip to minimize image |

**docker-compose.yml:**
- Service: `cv-editor`
- Port: `127.0.0.1:${PORT:-3001}:${PORT:-3001}`
- Command: `npm install --production && node server.js`
- Volumes: project root + persistent `node_modules`

<a id="cv-cicd"></a>
### CI/CD

**`.github/workflows/ci.yml`** — 2 jobs:

1. **Test** (ubuntu-latest, Node 22): `npm install && npm test` in `editor/`
2. **Build PDF** (ubuntu-latest): uses `xu-cheng/latex-action@v3` with lualatex, pre-installs fonts, builds `cv.tex`, `resume.tex`, `coverletter.tex`

<a id="cv-environment-variables"></a>
### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | 3000 | Express bind port |
| `HOST` | 127.0.0.1 | Bind address |
| `CV_DB_PATH` | `../cv.db` | SQLite database path |
| `CV_CORS_ORIGINS` | localhost + GitHub Pages | Comma-separated CORS allowlist |

<a id="cv-architectural-patterns"></a>
### Architectural Patterns

1. **Type-agnostic entries with JSON fields** — Sections don't constrain schemas
2. **Transaction-based operations** — Multi-step workflows (reorder, import) wrapped in atomic transactions
3. **Debounced autosave** — 500ms delay on changes to reduce API calls
4. **Variant-specific rendering** — Same data, different output (resume filters entries/items, cv shows all)
5. **Prepared statements** — All DB queries use prepared statements for injection safety
6. **Middleware validation** — AJV schemas enforce request shapes before DB operations
7. **Brace-aware parsing** — Custom extractors handle nested LaTeX braces correctly
8. **Snapshot-based multi-person** — Full JSON export per person stored in `persons.data`
9. **Server-side compilation** — LaTeX runs server-side (secure, no client dependencies)

<a id="cv-dependencies"></a>
### Dependencies

| Purpose | Package | Version |
|---------|---------|---------|
| Web framework | express | 4.21.0 |
| Database | better-sqlite3 | 12.8.0 |
| Validation | ajv | 8.18.0 |
| CORS | cors | 2.8.5 |
| Frontend | Alpine.js | 3.14.8 (CDN) |
| Drag-drop | SortableJS | 1.15.0 (CDN) |
| Test runner | vitest | 4.1.2 |
| DOM testing | happy-dom | 20.8.9 |
| DOM queries | @testing-library/dom | 10.4.1 |

---

<a id="nonogram-solver"></a>
## Nonogram Solver

**Package location:** `packages/nonogram`

<a id="nonogram-overview"></a>
### Overview

Quantum and classical solver for nonogram (Picross) puzzles with a production-ready web UI, benchmarking infrastructure, and IBM quantum hardware integration. Combines a brute-force SAT solver with Grover's quantum algorithm. Supports puzzle sizes up to 10x10 (lookup table constraint).

<a id="nonogram-core-python-package"></a>
### Core Python Package

**`nonogram/` package structure:**

| Module | Lines | Purpose |
|--------|-------|---------|
| `core.py` | 386 | Boolean SAT encoding, grid helpers, clue computation |
| `classical.py` | 174 | Brute-force exhaustive search solver |
| `quantum.py` | 300+ | Grover's algorithm (local simulator + IBM hardware) |
| `solver.py` | 120 | Solver ABC + 3 concrete implementations |
| `errors.py` | 45 | Custom exception hierarchy |
| `io.py` | 150+ | JSON puzzle I/O (`.non.json` format) |
| `data.py` | 150+ | Precomputed clue-to-pattern lookup table (lines 1-10) |
| `metrics.py` | 200+ | Benchmarking, circuit analysis, comparison reports |
| `__init__.py` | — | 54 public exports |

#### core.py — SAT Encoding & Grid Utilities

| Function | Purpose |
|----------|---------|
| `var_clauses(n, d)` | Maps n*d grid cells to boolean variable indices (row-major). Returns `(row_vars, col_vars)`. |
| `validate(rows, cols, r_clues, c_clues)` | Validates dimensions match clue counts. Raises `ValidationError`. |
| `display_nonogram(bit_string, n, d)` | ASCII box-drawing render (filled: black-square, empty: white-square). |
| `rle(bits)` | Run-length encode boolean sequence to clue tuple. |
| `grid_to_clues(grid)` | Compute row/column clues from completed grid. |
| `parse_clue(text)` | Parse space-separated clue string to tuple. |
| `puzzle_to_boolean(row_clues, col_clues, classical=False)` | Convert nonogram to SAT formula. Classical mode returns `(clause_list, var_count)` with DNF. Quantum mode returns boolean expression string with `~`, `&`, `\|` operators. |

Bitstring convention: Bit 0 = leftmost cell (differs from Qiskit's little-endian).

#### classical.py — Brute-Force Solver

**`ExecutionCounts` dataclass** — Fine-grained instrumentation:
- `candidates_evaluated`, `clause_evaluations`, `subclause_evaluations`, `literal_evaluations`
- `early_terminations`, `solutions_found`
- Computed: `literals_per_candidate`, `clauses_per_candidate`

**`classical_solve(puzzle, manual_check=None, verbose=False, collect_counts=False)`:**
- Iterates through all 2^(n*d) candidates
- `manual_check` validates a single bitstring
- Returns list of satisfying bitstrings, optionally with `ExecutionCounts`
- Complexity: O(2^(n*d) * C)

#### quantum.py — Grover's Algorithm

**Local Simulator (`quantum_solve`):**
- Uses `StatevectorSampler` (exact noiseless simulation)
- Constructs boolean expression via `puzzle_to_boolean()`
- Wraps oracle in `PhaseOracleGate` -> `AmplificationProblem` -> `Grover.amplify()`
- Returns `GroverResult` with probability distribution
- No IBM account needed

**Hardware Integration (`quantum_solve_hardware`):**

| Parameter | Default | Purpose |
|-----------|---------|---------|
| `token` | required | IBM Quantum API token |
| `backend_name` | None (auto) | Specific backend or least-busy auto-selection |
| `channel` | `ibm_quantum_platform` | IBM service channel |
| `shots` | 1024 | Measurement repetitions |
| `iterations` | 1 | Grover iterations |
| `dynamical_decoupling` | True | XpXm sequence to suppress idle-qubit decoherence |
| `twirling` | True | Pauli twirling to convert coherent errors to depolarizing noise |

Transpiles with `optimization_level=3` (aggressive gate reduction).

**Iteration guidance:**

| Grid | Qubits | Search Space | k=1 | k=3 | k=5 | k=9 |
|------|--------|-------------|------|------|------|------|
| 2x2 | 4 | 16 | — | — | — | — |
| 3x3 | 9 | 512 | 1.8% | 9.3% | 22.6% | 64.2% |

**NISQ depth constraints:** 2x2 ~142 depth (feasible), 3x3 ~2900 (noise dominates), 4x4+ >10000 (beyond current hardware).

Additional: `list_backends(token, channel)`, `extract_counts(data, creg_names)`.

Bitstring convention: Qiskit uses little-endian; all returned bitstrings must be reversed (`bs[::-1]`) for row-major grid interpretation.

#### solver.py — Solver Interface

| Class | Name | Backend |
|-------|------|---------|
| `Solver` (ABC) | — | Abstract: `name` property + `solve(puzzle)` method |
| `ClassicalSolver` | "Classical" | `classical_solve()` |
| `QuantumSimulatorSolver` | "Quantum (Simulator)" | `quantum_solve()` |
| `QuantumHardwareSolver` | "Quantum (Hardware: {backend})" | `quantum_solve_hardware()` |

#### errors.py — Exception Hierarchy

```
NonogramError (root)
+-- ValidationError          (also: ValueError)
+-- SolverError
|   +-- ClassicalSolverError
|   +-- QuantumSolverError
|       +-- HardwareError
+-- PuzzleIOError            (also: OSError)
```

Multiple inheritance allows `ValidationError` to be caught by both `except NonogramError` and `except ValueError`.

#### io.py — Puzzle Serialization

File format: `.non.json`

```json
{
  "name": "Puzzle Name",
  "rows": 4, "cols": 6,
  "row_clues": [[1,1], [2,2], [1,2,1], [1,1]],
  "col_clues": [[4], [1], [1], [1], [1], [4]],
  "created": "2026-03-11T12:00:00+00:00",
  "tags": []
}
```

Functions: `save_puzzle`, `load_puzzle`, `save_batch`, `load_batch`. Max size: 10x10.

#### data.py — Clue Lookup Table

Precomputed constraint database for O(1) pattern enumeration.

- **`possible_d`** — Main lookup table. Keys: `"length/clue1;clue2;..."`. Values: list of valid bitstring patterns as integers. Coverage: line lengths 1-10.
- **`valid_line_configs(line_len, clue)`** — Count of valid configurations per line.
- **`constraint_density(row_clues, col_clues)`** — Puzzle difficulty metric.

#### metrics.py — Benchmarking & Analysis

**Dataclasses:**

| Class | Key Fields |
|-------|-----------|
| `ClassicalMetrics` | `solve_time_s`, `configurations_evaluated`, `solutions_found`, `peak_memory_kb`, `clause/subclause/literal_evaluations`, `early_terminations`. Computed: `configs_per_second`, `early_termination_rate`. |
| `QuantumMetrics` | `solve_time_s`, `num_qubits`, `circuit_depth`, `total_gate_count`, `two_qubit_gate_count`, `gate_counts_by_type`, `grover_iterations`, `top_result_probability`, `signal_to_noise`, `distribution_entropy`. |
| `StaticCircuitAnalysis` | `num_qubits`, `circuit_depth`, `total_gate_count`, `two_qubit_gate_count`. Computed: `two_qubit_gate_density`, `depth_per_iteration`, `gates_per_qubit`, `ancilla_ratio`. |
| `ComparisonReport` | All three above + solution space analysis, constraint density, hardware requirements, speedup ratios. |

Functions: `benchmark(puzzle)`, `analyze_circuit(circuit)`, `print_report(report)`.

<a id="nonogram-flask-backend"></a>
### Flask Backend

**`tools/webapp.py`** — Flask + Socket.IO server:

| Feature | Detail |
|---------|--------|
| Transport | Flask-SocketIO (threading async mode) |
| CORS | Regex matching localhost:*, explicit `andypeterson.dev` |
| SSL/TLS | Auto-uses `DEV_CERT_DIR` or `.certs/` for dev HTTPS |
| Port | Auto-assigned free port if `PORT=0` or unset |
| Browser launch | 1.2 second delayed auto-open |

**Environment Variables:**

| Variable | Default | Purpose |
|----------|---------|---------|
| `NONOGRAM_HOST` | `127.0.0.1` | Bind address |
| `PORT` | auto-assigned | Server port |
| `DEV_CERT_DIR` | — | Dev TLS certificate directory |
| `NONOGRAM_SECRET_KEY` | random 32-byte hex | Flask session key |
| `NONOGRAM_CORS_ORIGINS` | — | Extra CORS origins |

**`tools/config.py`** — Shared constants: `MAX_CLUES=3`, `MAX_GRID=10`, `PUZZLES_DIR`, `RUNS_DIR`.

**`tools/state.py`** — Thread-safe server state:

```python
{
  "rows": 4, "cols": 4,
  "grid": [[False]...],
  "hw_config": None,
  "busy": False,
  "puzzle_name": "puzzle",
}
```

Protected by `threading.Lock`. Socket.IO helpers: `emit_status()`, `set_busy()`.

**Routes (Flask Blueprints):**

| Blueprint | Endpoints | Purpose |
|-----------|-----------|---------|
| `grid_bp` | `POST /api/grid`, `POST /api/randomize` | Update/randomize grid (validates 1 <= rows/cols <= 10) |
| `solver_bp` | `POST /api/solve/classical`, `POST /api/solve/quantum`, `POST /api/solve/benchmark` | Trigger solvers in background threads. Socket.IO events: `cl_done`, `qu_done`, `bench_done`, `solver_error`. Error sanitization redacts long alphanumeric strings (likely API tokens). Results persisted to `RUNS_DIR/run_<uuid>.json`. |
| `puzzle_bp` | `POST /api/puzzle/load`, `POST /api/puzzle/save` | Upload/download `.non.json` files |
| `hardware_bp` | `POST /api/hw/backends`, `POST /api/hw/config` | List IBM backends (requires token), connect/disconnect hardware |
| `runs_bp` | `GET /api/runs/info`, `POST /api/runs/delete` | Cache metadata, clear run files |

**`tools/chart.py`** — Matplotlib rendering: `report_to_dict(report)`, `render_chart_b64(report, cl_times, qu_times)` (returns base64-encoded PNG).

<a id="nonogram-frontend"></a>
### Frontend

**`website/index.html`** — Single-page app with three-panel layout:

```
+-------------------+-------------------+--------------------+
| SIDEBAR           | MAIN CONTENT      | SETTINGS PANEL     |
| Draw/Clues Editor | Solution Grid     | Theme toggle       |
|                   | + Log Terminal    | Run log            |
|                   | + Histogram       | IBM Hardware Config|
+-------------------+-------------------+--------------------+
```

**Libraries (CDN):** Socket.IO 4.7.5, Font Awesome 6.5.1, Google Fonts (Atkinson Hyperlegible), UI Kit v1.1

**Frontend modules:**

| Module | Purpose |
|--------|---------|
| `website/static/state.js` | `window.App` namespace: grid state, clues, histogram data, hardware status, UI modes, DOM refs, SVG icon constants |
| `website/static/grid.js` | Grid init, clue computation (`rle`, `computeRowClues`, `computeColClues`), interactive table with corner buttons, pan/zoom, resize handles, random/clear/open/save buttons |
| `website/static/solver.js` | `renderClassical` (solution tables), `renderQuantum` (probability distribution, auto-threshold at 3x random baseline or 0.5%), `drawHistogram` (SVG bar chart with interactive tooltip and draggable threshold line), `renderBenchmark` (multi-trial with navigation) |
| `website/static/ui.js` | Sidebar/settings toggles, Draw/Clues mode switch, theme toggle (dark/light with sun/moon icons, localStorage), hardware status indicator, status terminal (timestamped+color-coded), busy state (disable buttons+spinner), solution grid magnification (S/M/L) |
| `website/static/app.js` | Socket.IO client init, event binding, grid/resize/theme initialization, threshold input handling, tooltip following |

**Socket.IO events:** `status`, `busy`, `cl_done`, `qu_done`, `bench_done`, `solver_error`, `hw_status`. Auto-reconnect on disconnect.

**`website/package.json`:** Vitest + jsdom for frontend tests.

<a id="nonogram-testing"></a>
### Testing

**Python tests (`pytest`):**

| File | Purpose | IBM API Cost |
|------|---------|-------------|
| `test_core.py` | Boolean encoding, variable indexing | None |
| `test_core_edge_cases.py` | Edge cases in SAT formulation | None |
| `test_classical.py` | Classical solver on small puzzles | None |
| `test_classical_verification.py` | Solution correctness | None |
| `test_quantum.py` | Grover algorithm basics | None |
| `test_quantum_robustness.py` | Quantum solver noise/variance | None |
| `test_io.py` | JSON save/load, batch operations | None |
| `test_metrics.py` | Benchmark infrastructure | None |
| `test_errors.py` | Exception hierarchy | None |
| `test_editor_logic.py` | Clue computation, `grid_to_clues` | None |
| `test_solver_abc.py` | Solver interface compliance | None |
| `test_data_validation.py` | Clue validation, constraint density | None |
| `test_encoding_validation.py` | Boolean expression correctness | None |
| `test_constraint_density.py` | Puzzle difficulty metrics | None |
| `test_execution_counts.py` | ExecutionCounts instrumentation | None |
| `test_static_circuit.py` | Static circuit analysis | None |
| `test_hardware_parsing.py` | Backend listing, DataBin extraction | 1 REST call |
| `test_hardware_2x2.py` | 2x2 Grover on real hardware | 1 circuit submission |
| `test_hardware_3x3.py` | 3x3 pipeline on real hardware | 1 circuit submission |
| `test_integration.py` | End-to-end solver workflows | None |
| `test_routes.py` | Flask routes with mocked solvers | None |
| `test_socketio_integration.py` | Socket.IO event flow | None |
| `test_cors.py` | CORS header validation | None |
| `test_api_contract.py` | API endpoint contracts | None |
| `test_api_integration.py` | Full API integration | None |
| `test_benchmark_harness.py` | Benchmarking infrastructure | None |
| `test_chart.py` | Chart rendering | None |
| `test_webapp_config.py` | Flask app configuration | None |
| `test_phase1_solver.py` | Grover solver components (AST structural) | None |
| `test_phase2_infra.py` | Benchmarking infrastructure | None |
| `test_phase3_crosscutting.py` | Cross-cutting concerns | None |

**JS frontend tests (Vitest + jsdom):** `grid.test.js`, `solver.test.js`, `state.test.js` with shared helpers.

**pytest.ini markers:** `slow` (deselect with `-m "not slow"`)

<a id="nonogram-cicd"></a>
### CI/CD

**`.github/workflows/tests.yml`** — CI:
- Trigger: push to main + PRs
- Matrix: Python 3.10, 3.11, 3.12 on ubuntu-latest
- `pytest tests/ -v --tb=short -m "not slow"` (skip expensive classical tests)
- `ruff check .`
- Docker image build

**`.github/workflows/deploy-pages.yml`** — Static site deployment:
- Trigger: push to main
- Uploads `website/` directory to GitHub Pages

<a id="nonogram-docker"></a>
### Docker

**Dockerfile:**
- Base: `python:3.12-slim`
- Generates self-signed dev certificates in `/.certs`
- Entry: `python tools/webapp.py`
- Supports HTTPS in dev mode

**docker-compose.yml:**
- Service: `nonogram`
- Port: `127.0.0.1:${NONOGRAM_PORT}:${NONOGRAM_PORT}` (default 5055)
- Environment: `PORT`, `DEV_CERT_DIR`, `NONOGRAM_HOST`

<a id="nonogram-performance-baselines"></a>
### Performance Baselines

| Grid | Classical | Quantum Simulator | Notes |
|------|-----------|-------------------|-------|
| 2x2 | <1 ms | ~ms | Trivial |
| 3x3 | ~50 ms | ~100 ms | Feasible |
| 4x4 | ~2 sec | ~minutes | Slow |
| 4x6 | ~18 min | >hours | Very slow |
| 6x6+ | Impractical | Impractical | Exponential growth |

<a id="nonogram-dependencies"></a>
### Dependencies

| Purpose | Package | Version |
|---------|---------|---------|
| Quantum circuits | qiskit | >=2.2,<3.0 |
| Grover's algorithm | qiskit-algorithms | >=0.3,<1.0 |
| IBM hardware | qiskit-ibm-runtime | >=0.30,<1.0 |
| Web framework | flask | >=3.0,<4.0 |
| CORS | flask-cors | >=4.0,<5.0 |
| WebSocket | flask-socketio | >=5.3,<6.0 |
| Arrays | numpy | >=1.24,<3.0 |
| Charts | matplotlib | >=3.7,<4.0 |
| Dev: lint | ruff | >=0.4 |
| Dev: tests | pytest | >=7.0,<9.0 |

---

<a id="quantum-protein-kernel"></a>
## Quantum Protein Kernel

**Package location:** `packages/quantum-protein-kernel`

<a id="qpk-overview"></a>
### Overview

Multi-dataset classifier platform comparing classical and quantum-hybrid neural network approaches. Plugin architecture for datasets (MNIST, Iris). Features live training via SSE, real-time loss curves, draw-to-predict (MNIST), form-to-predict (Iris), model persistence, early stopping, knowledge distillation, ensemble evaluation, and ablation studies.

<a id="qpk-core-abstractions"></a>
### Core Abstractions

#### BaseModel ABC (`base_model.py`)

| Method | Signature | Default |
|--------|-----------|---------|
| `forward` | `(x: torch.Tensor) -> torch.Tensor` | Abstract — returns logits |
| `loss_fn` | `(output, target) -> torch.Tensor` | Cross-entropy |

Subclasses: MNISTNet, LinearNet, SVMNet, Quadratic, Polynomial, QVC, QiskitCNN, QiskitLinear, IrisLinear, IrisSVM, IrisQVC.

#### DatasetPlugin ABC (`dataset_plugin.py`)

**Required attributes:**

| Attribute | Type | Purpose |
|-----------|------|---------|
| `name` | str | URL slug ("mnist", "iris") |
| `display_name` | str | UI label |
| `input_type` | `Literal["image", "tabular"]` | Input modality |
| `num_classes` | int | Number of output classes |
| `class_labels` | list[str] | Human-readable labels |
| `image_size` | tuple[int,int] \| None | Image dimensions |
| `image_channels` | int \| None | Channel count |
| `feature_names` | list[str] \| None | Tabular feature names |

**Required methods:**

| Method | Purpose |
|--------|---------|
| `get_train_loader(batch_size)` | Training DataLoader |
| `get_test_loader(batch_size)` | Test DataLoader |
| `preprocess(raw_input)` | PIL.Image or dict -> tensor |
| `get_model_types()` | `dict[str, type[BaseModel]]` |

**Optional methods:** `get_val_loader` (enables early stopping), `get_default_hyperparams`, `get_ui_config`.

<a id="qpk-dataset-plugins"></a>
### Dataset Plugins

#### MNIST Plugin

| Property | Value |
|----------|-------|
| Name | `mnist` |
| Display name | MNIST Handwritten Digits |
| Input type | image |
| Classes | 10 (digits 0-9) |
| Image size | 28x28, 1 channel |
| Train/Val/Test | 55,000 / 5,000 / 10,000 |
| Normalization | z-score (mean=0.1307, std=0.3081) |

**Model types (7):**

| Model | Architecture | Approx Accuracy |
|-------|-------------|-----------------|
| CNN (MNISTNet) | Conv2d(1->32) + Conv2d(32->64) + FC(9216->128->10) | ~99% |
| Linear (LinearNet) | Flatten + Linear(784->10) | ~92% |
| SVM (SVMNet) | Flatten + Linear(784->10) + hinge loss | ~91-92% |
| Quadratic | CNN + Quadratic(32->16) + FC(16->10) | ~98-99% |
| Polynomial | CNN + Polynomial layer + FC(->10) | ~98-99% |
| Qiskit-CNN | CNN + QiskitQLayer quantum circuit | Optional |
| Qiskit-Linear | Linear + QiskitQLayer quantum circuit | Optional |

#### Iris Plugin

| Property | Value |
|----------|-------|
| Name | `iris` |
| Display name | Iris Flower Classification |
| Input type | tabular |
| Classes | 3 (setosa, versicolor, virginica) |
| Features | sepal_length, sepal_width, petal_length, petal_width |
| Train/Val/Test | 96 / 24 / 30 (stratified, seed 42) |
| Normalization | z-score per training set statistics |

**Model types (3):**

| Model | Architecture | Approx Accuracy |
|-------|-------------|-----------------|
| Linear (IrisLinear) | Linear(4->3) | ~95-97% |
| SVM (IrisSVM) | Linear(4->3) + hinge loss | ~94-96% |
| QVC (IrisQVC) | 4 qubits, AngleEmbedding(Y) -> StronglyEntanglingLayers(2) -> measure Z0,Z1,Z2 | ~93-96% |

IrisQVC uses PennyLane: 24 trainable parameters (2 layers x 4 qubits x 3 rotations).

<a id="qpk-training-evaluation-prediction"></a>
### Training, Evaluation, Prediction

#### Trainer (`trainer.py`)

Constructor: `model_cls`, `train_loader`, `dataset`, `epochs=3`, `lr=1e-3`, `config=TrainingConfig?`, `val_loader?`, `early_stop_min_accuracy=0.6`

`train(on_status)` loop:
1. Instantiate model, create Adam optimizer
2. For each epoch -> for each batch -> forward -> loss -> backward -> step
3. **Distillation:** blends student loss with teacher output (MSE) via `distill_weight`
4. **Regularization:** adds `regularization_fn(model)` to loss if provided
5. **Validation checkpoints:** runs `val_loader` every `val_gap` batches
6. **Early stopping:** halts if no improvement for `patience` epochs (after `early_stop_min_accuracy` met)

Returns: `TrainResult` with model, epochs_completed, best_val_accuracy, history, num_params, stopped_early.

#### Evaluator (`evaluator.py`)

| Mode | Input | Output |
|------|-------|--------|
| Single | `evaluate(model, test_loader, ...)` | `EvalResult`: accuracy, avg_loss, per_class_accuracy, num_params |
| Ensemble | `ensemble_evaluate(models, test_loader, ...)` | Majority vote with logit-sum tie-breaking |
| Ablation | `ablation_evaluate(model, test_loader, ...)` | Per-layer accuracy drop (deep-copies model, zeros each layer's params) |

#### Predictor (`predictor.py`)

`Predictor(model, plugin)` -> `predict(raw_input)`:
- Delegates preprocessing to plugin
- Runs model in eval mode (no gradients)
- Applies softmax to logits
- Returns probability array of shape `(num_classes,)`

<a id="qpk-model-registry--persistence"></a>
### Model Registry & Persistence

#### ModelRegistry (`model_registry.py`)

Thread-safe in-memory store, namespaced by dataset.

| Method | Purpose |
|--------|---------|
| `add(dataset, name, model, ...)` | Register trained model |
| `remove(dataset, name)` | Delete model |
| `get(dataset, name)` | Retrieve `ModelEntry` |
| `names(dataset)` | List model names |
| `items(dataset)` | List all entries |
| `update_eval_result(...)` | Attach evaluation results |
| `next_name(dataset)` | Auto-increment ("Model 1", "Model 2", ...) |

`ModelEntry` fields: model, model_type, dataset, epochs, batch_size, lr, eval_result, training_history, num_params.

#### ModelPersistence (`persistence.py`)

| Method | Purpose |
|--------|---------|
| `save(name, entry)` | Write `.pt` checkpoint (state_dict, metadata, history). Sanitizes filename. |
| `load(filename)` | Read checkpoint, reconstruct model via `plugin_registry.create_model()`, set eval mode. Uses `weights_only=True`. |
| `list_files()` | List available checkpoints with metadata. |

<a id="qpk-rest-api--routes"></a>
### REST API & Routes

**Request hook:** `url_value_preprocessor` resolves dataset slug -> plugin lookup on `g.plugin`. Unknown datasets return 404.

#### Main Routes

| Endpoint | Purpose |
|----------|---------|
| `GET /` | Redirect to first dataset's index |
| `GET /d/<dataset>/` | Render SPA (`index.html` with Jinja2 `UI_CONFIG`) |
| `GET /api/datasets` | JSON list of `{name, display_name, input_type}` |
| `GET /api/datasets/<name>/config` | `{ui_config, model_types}` |
| `GET /health` | `{status, uptime, clients, timestamp}` |

#### Training Route

`POST /d/<dataset>/train`

```json
{
  "model_type": "CNN",
  "epochs": 3,
  "batch_size": 64,
  "lr": 0.001,
  "name": "My Model",
  "patience": 5,
  "val_gap": 50,
  "teacher": "Model 1",
  "distill_weight": 0.5
}
```

Response: **SSE stream** of events:
- `{"type": "status", "msg": "Epoch 1/3 - batch 50/938 - loss: 0.4521"}`
- `{"type": "history", "epoch": 0, "batch": 50, "train_loss": 0.45, "val_accuracy": 0.95}`
- `{"type": "done", "name": "...", "model_type": "...", "num_params": 123456, ...}`
- `{"type": "error", "msg": "..."}`

Spawns daemon thread, queues events, streams via `sse_response(queue)`.

#### Evaluation Routes

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/d/<dataset>/evaluate` | POST | SSE stream evaluating all registered models |
| `/d/<dataset>/ensemble` | POST | `{"model_names": [...]}` -> ensemble accuracy |
| `/d/<dataset>/ablation` | POST | `{"model_name": "..."}` -> SSE stream of per-layer accuracy drops |

#### Model Routes

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/d/<dataset>/predict` | POST | `{"image": "<b64>"}` or `{"features": {...}}` -> per-model predictions |
| `/d/<dataset>/models` | GET | List all session models with metadata |
| `/d/<dataset>/models/<name>` | DELETE | Remove model from session |
| `/d/<dataset>/models/<name>/export` | POST | Save to disk as `.pt` |
| `/d/<dataset>/models/disk` | GET | List `.pt` files for this dataset |
| `/d/<dataset>/models/disk/<filename>/load` | POST | Load checkpoint into session (auto-dedup names) |
| `/d/<dataset>/model-info/<model_type>` | GET | Render MODELS.md section as HTML |

<a id="qpk-special-layers--loss-functions"></a>
### Special Layers & Loss Functions

#### Quadratic Layer (`layers.py`)

```
forward(x):  z = concat(x^T * x, x)  ->  fc(z)
```
Includes pairwise products + original linear terms. `input_dim * (input_dim + 1)` features.

#### Polynomial Layer (`layers.py`)

```
forward(x):  y = exp(W * log(|x| + 1))
```
With clamping at [-10, 10] to prevent overflow.

#### Multi-class Hinge Loss (`losses.py`)

Crammer-Singer formulation: `sum of max(0, score_j - score_correct + margin)` for j != correct. Used by SVM models.

#### Qiskit Quantum Layer (`qiskit_layers.py`)

`QiskitQLayer` — Multi-headed parametric quantum circuit:
- Feature encoding via parameterized RX gates
- Linear entanglement topology (reduced depth)
- Measurement with finite-difference gradient estimation (parameter-shift rule)
- Integration into PyTorch backpropagation

<a id="qpk-frontend"></a>
### Frontend

**Templates:** `classifiers/templates/index.html` — SPA with Jinja2 `UI_CONFIG` injection (plugin metadata, model types, default hyperparams). Renders dataset-specific input widget (canvas for MNIST, form for Iris). Two-column layout: left (train/config), right (canvas/form + model table).

**Static JS:**

| File | Purpose |
|------|---------|
| `js/app.js` | State management, canvas drawing, model table, form handling, localStorage persistence |
| `js/sse.js` | SSE event consumer, progress streaming, queue handling |
| `js/chart.js` | Canvas-based training curve rendering (loss/accuracy plots) |

**Static CSS:** `css/app.css` — dark/light theming, layout, canvas styles, chart rendering.

<a id="qpk-testing"></a>
### Testing

**425+ tests:**

| File | Coverage |
|------|----------|
| `test_base_model.py` | BaseModel construction, forward passes |
| `test_model.py` | Individual model architecture tests |
| `test_all_models_train.py` | Training loop for all architectures |
| `test_trainer.py` | Trainer with early stopping, distillation, history |
| `test_evaluator.py` | Single, ensemble, ablation evaluation |
| `test_predictor.py` | Inference pipeline, preprocessing |
| `test_model_registry.py` | Registry CRUD, namespacing |
| `test_persistence.py` | Save/load checkpoints, filename safety |
| `test_routes.py` | Flask endpoints, request/response formats |
| `test_plugin_registry.py` | Plugin discovery, registration |
| `test_iris.py` | Iris plugin data loading, models |
| `test_layers.py` | Quadratic, Polynomial forward/backward |
| `test_qiskit_layers.py` | Qiskit circuit layer (conditional) |
| `test_integration.py` | Full training -> evaluation -> prediction pipeline |
| `dom/test_dom_integration.py` | DOM-based integration tests |
| `test_documentation.py` | Docstring completeness, examples |

<a id="qpk-cicd"></a>
### CI/CD

**`.github/workflows/ci.yml`** — 3 jobs:

1. **test** (Python 3.12): `pip install -r requirements.txt pytest`, `pytest tests/ -v`
2. **lint** (Python 3.12): `ruff check classifiers/ tests/`
3. **docker**: `docker build -t qml-classifiers .`

<a id="qpk-docker"></a>
### Docker

**Dockerfile:**
- Base: `python:3.12-slim`
- Installs PyTorch 2.2.2+cpu from official PyTorch wheels (no GPU)
- Mounts `.certs/` for optional HTTPS
- Entry: `python -m classifiers`

**docker-compose.yml:**
- Service: `classifier`
- Port: `127.0.0.1:${CLASSIFIER_PORT}:${CLASSIFIER_PORT}`
- Environment: `CLASSIFIERS_PORT`, `CLASSIFIERS_HOST=0.0.0.0`, `CLASSIFIERS_CORS_ORIGINS`, `DEV_CERT_DIR=""`

<a id="qpk-dependencies"></a>
### Dependencies

| Purpose | Package | Version |
|---------|---------|---------|
| Web framework | flask | >=3.0 |
| CORS | flask-cors | >=6.0 |
| Deep learning | torch | >=2.2 |
| Vision | torchvision | >=0.17 |
| Arrays | numpy | >=1.26 |
| Images | Pillow | >=12.0 |
| Markdown | mistune | >=3.0 |
| ML utilities | scikit-learn | >=1.5 |
| Quantum (optional) | qiskit | >=1.0 |
| Quantum (optional) | qiskit-aer | >=0.13 |
| Quantum (optional) | pennylane | >=0.35 |
| Dev: tests | pytest | >=8.0 |
| Dev: e2e | pytest-playwright | >=0.5 |
| Dev: lint | ruff | >=0.3 |

<a id="qpk-architectural-patterns"></a>
### Architectural Patterns

1. **Plugin Architecture (OCP):** `DatasetPlugin` ABC is the sole extension point; new datasets require only a new subpackage under `classifiers/datasets/`
2. **Dependency Inversion (DIP):** Services in `app.extensions[...]`; routes access via `current_app.extensions[key]`
3. **Single Responsibility (SRP):** Trainer, Evaluator, Predictor, Registry, Persistence are each separate modules
4. **SSE for long operations:** Training, evaluation, ablation stream progress via queue -> Flask streaming response
5. **Daemon threads:** Long-running ops execute in background threads with queue-based progress
6. **Thread safety:** `ModelRegistry` uses `threading.Lock`; `ConnectionTracker` tracks SSE clients
7. **Lazy imports:** Qiskit and PennyLane imported only when quantum models instantiated

---

<a id="quantum-video-chat-qvc"></a>
## Quantum Video Chat (QVC)

**Package location:** `packages/qvc`

<a id="qvc-overview"></a>
### Overview

Browser-native P2P video chat implementing BB84 quantum key distribution over WebRTC DataChannels. Simulated quantum optical channel models real hardware parameters (Poisson photon statistics, fiber attenuation, single-photon APD detectors, eavesdropping detection). AES-128-GCM frame encryption via Insertable Streams Web Worker.

Architecture:
- **Signaling Server** (Python/Flask + Socket.IO): Room management, SDP/ICE relay only — media never touches server
- **WebRTC P2P**: Direct browser-to-browser media transport
- **Insertable Streams**: AES-128-GCM frame encryption in Web Worker (RTCRtpScriptTransform)
- **BB84 Protocol** (JavaScript): Sifting, QBER estimation, Cascade error correction, Toeplitz privacy amplification

<a id="qvc-signaling-server"></a>
### Signaling Server

**`signaling/server.py`** (~193 lines) — Flask + Socket.IO:

**REST Endpoints:**

| Endpoint | Purpose |
|----------|---------|
| `GET /admin/status` | Health + metrics (rooms, peers, uptime, peak counts, avg session duration) |
| `GET /admin/events` | Recent events with optional `limit` param |
| `GET /admin/rooms` | Active room summaries (room_id, peers, is_full) |
| `GET /admin/peers` | Connected peers (sid, room_id, peer) |

**CORS:** Accepts `http://localhost:*`, `https://localhost:*`, `https://andypeterson.dev`.

**Socket.IO Signaling Events:**

| Event | Direction | Purpose |
|-------|-----------|---------|
| `connect` | client->server | Register peer, emit `welcome` with sid |
| `disconnect` | client->server | Unregister, notify room partner (`peer-disconnected`) |
| `create_room` | client->server | Generate 5-digit room ID, make peer room creator |
| `join_room` | client->server | Join room, notify both peers with initiator flag |
| `leave_room` | client->server | Leave room, notify partner, clean up if empty |
| `offer` | client->server->client | Relay SDP offer to other peer |
| `answer` | client->server->client | Relay SDP answer to other peer |
| `ice_candidate` | client->server->client | Relay ICE candidate to other peer |

**`signaling/main.py`:** Port discovery via OS-assigned socket, eventlet WSGI server, graceful shutdown (SIGINT/SIGTERM).

<a id="qvc-room-management"></a>
### Room Management

**`signaling/rooms.py`** (~295 lines):

**Data structures:**
- `Peer`: `sid`, `room_id` (None if not in room)
- `Room`: `room_id`, `peers` list (max 2), properties: `is_full`, `is_empty`, `other_peer(sid)`

**RoomManager:**

| Feature | Detail |
|---------|--------|
| Room ID | 5-digit numeric (10000-99999), cryptographically random |
| Metrics | `uptime_seconds`, `total_connections`, `total_sessions`, `peak_rooms`, `peak_peers` |
| Session tracking | Rolling list (max 200) of session durations for avg calculation |
| Event log | Max 100 entries: peer_connected, room_created, peer_joined, peer_left, peer_disconnected |

Methods: `register_peer`, `unregister_peer`, `create_room`, `join_room`, `leave_room`, `get_room`, `get_peer`, `log_event`, `get_events`, `get_rooms_summary`, `get_peers_summary`.

<a id="qvc-frontend-application"></a>
### Frontend Application

**`website/client/static/app.js`** (~192 lines):

**Global state:**

```
signalingConnected, peerConnected, roomId, isInitiator, waitingForPeer,
cameraOn, muted, elapsed, bb84Active, qber, qberHistory, keyBudget,
encryptionEnabled, errorMessage
```

**Functions:** `connectToSignaling(url)`, `handleCreateRoom()`, `handleJoinRoom(e)`, `handleLeave()`, `toggleCamera()`, `toggleMute()`, `startTimer()`, `stopTimer()`, `showToast(msg)`, `render()` (lobby vs in-call UI).

**Theme:** localStorage `qvc-theme` (dark/light).

**Styling (`style.css`, ~668 lines):** Dark theme default with light overrides. Color scheme: warm brown/gold/teal palette. Components: `.main-screen`, `.header`, `.lobby`, `.incall`, `.quantum-panel`, `.toast`, `.noise-canvas-wrapper`.

<a id="qvc-webrtc-management"></a>
### WebRTC Management

**`website/client/static/js/webrtc.js`** (~269 lines) — `WebRTCManager`:

| Feature | Detail |
|---------|--------|
| ICE servers | `stun:stun.l.google.com:19302`, `stun:stun1.l.google.com:19302` |
| Data channel | Named `qkd`, ordered |
| Encryption | Optional Insertable Streams via `RTCRtpScriptTransform` |
| Worker | `/js/crypto-worker.js` (module type) |

**Lifecycle:**
1. `getLocalMedia(constraints)` -> `MediaStream`
2. `createRoom()` / `joinRoom(roomId)` -> Socket.IO signaling
3. If initiator: create `RTCPeerConnection`, data channel, add local tracks, send SDP offer
4. If joiner: create `RTCPeerConnection`, add local tracks, wait for offer, send answer
5. ICE candidates relayed through signaling server
6. `ontrack` -> emit `remote-stream`; if encryption enabled, apply decrypt transform
7. `leave()` -> cleanup peer connection

**Event emitter:** `on(event, callback)` pub/sub with `_listeners` map.

<a id="qvc-cryptography"></a>
### Cryptography

**`website/client/static/js/crypto.js`** (~80 lines) — Frame-level AES-128-GCM:

**Frame format:** `[keyIndex:2LE][iv:12][ciphertext+tag]`

| Function | Purpose |
|----------|---------|
| `importKey(rawKey)` | Import 16-byte raw key for AES-GCM |
| `encryptFrame(plaintext, key, keyIndex)` | Random 12-byte IV, AES-GCM encrypt, pack frame |
| `decryptFrame(encrypted, key)` | Parse keyIndex + IV + ciphertext, decrypt, return `{plaintext, keyIndex}` |
| `parseKeyIndex(encrypted)` | Fast key index extraction (first 2 bytes) |

**`website/client/static/js/crypto-worker.js`** (~124 lines) — Web Worker for `RTCRtpScriptTransform`:

- State: `currentKey`, `currentKeyIndex`
- Encrypt/decrypt frame processing with latency measurement
- Messages: `set-key`, metrics reporting (`encryptLatencyUs`, `decryptLatencyUs`, `decrypt-error`)
- Registers `rtctransform` event handler for Insertable Streams pipeline

<a id="qvc-bb84-quantum-key-distribution"></a>
### BB84 Quantum Key Distribution

**`website/client/static/js/bb84/protocol.js`** (~296 lines) — `BB84Protocol`:

**Constructor options:**

| Option | Default | Purpose |
|--------|---------|---------|
| `numRawBits` | 4096 | Qubits to transmit |
| `qberThreshold` | 0.11 | 11% security threshold |
| `targetKeyLength` | 128 | Bits in final key |

**Alice's Protocol (`runAsAlice()`):**
1. **Preparation:** Generate random bits + bases, create qubit objects
2. **Transmission:** Send qubits via quantum channel
3. **Basis reconciliation:** Exchange bases with Bob
4. **Sifting:** Keep only bits where bases matched (~50% survival)
5. **QBER Estimation:** Exchange sample bits, calculate error rate, abort if > threshold
6. **Error Correction:** Simplified binary Cascade (8-bit block parity exchange, bit flipping)
7. **Privacy Amplification:** Toeplitz hashing (random seed, XOR-based reduction to target length)
8. **Output:** `{key: Uint8Array | null, qber: number, metrics: BB84Metrics}`

**Bob's Protocol (`runAsBob()`):** Mirror of Alice's with measurement in random bases (correct if bases match, random 50/50 if mismatch).

**Helpers:** `_sift`, `_estimateQber`, `_errorCorrectAlice`, `_errorCorrectBob`, `_privacyAmplify`, `_randomBits`, `_bitsToBytes`.

**Channel interfaces (`channel.js`):**
- `IdealQuantumChannel` — Zero-noise in-memory channel with async backpressure
- `LoopbackClassicalChannel` — In-memory message passing with deep clone

<a id="qvc-simulated-quantum-channel"></a>
### Simulated Quantum Channel

**`website/client/static/js/bb84/simulated.js`** (~128 lines) — `SimulatedQuantumChannel`:

| Parameter | Default | Model |
|-----------|---------|-------|
| `fiberLengthKm` | 1.0 | Distance (affects attenuation) |
| `sourceIntensity` | 0.1 | Mean photons per pulse (Poisson) |
| `detectorEfficiency` | 0.10 | APD quantum efficiency |
| `eavesdropperEnabled` | false | Intercept-resend attack |

**Physics modeling stages per qubit:**
1. **Poisson photon source:** P(>=1 photon) = 1 - exp(-mu)
2. **Fiber attenuation:** loss = 0.2 dB/km (standard telecom), transmittance = 10^(-dB/10)
3. **Eavesdropper (if enabled):** Eve measures in random basis; wrong basis -> 50% bit flip; re-sends in her basis
4. **Detector:** P(detect | photon) = efficiency

Eavesdropper detection: intercept-resend causes QBER rise above 11% threshold.

<a id="qvc-metrics-collection"></a>
### Metrics Collection

**`website/client/static/js/metrics.js`** (~121 lines) — `MetricsCollector`:

| Option | Default | Purpose |
|--------|---------|---------|
| `windowSize` | 60 | Rolling window size |
| `keyBudgetLowWatermark` | 1024 | Bytes threshold |
| `qberThreshold` | 0.11 | 11% security threshold |

Methods: `record(name, value)`, `get(name)`, `getHistory(name, n)`, `evaluate()`.

Edge-triggered events: `qber-exceeded`, `qber-normal`, `key-budget-low`. Subscription via `subscribe(event, callback)`.

**BB84 Metrics (`bb84/metrics.js`):**
Fields: `rawBits`, `siftedBits`, `qber`, `keyLength`, `roundDurationMs`, `siftingEfficiency`, `isSecure`.

<a id="qvc-testing"></a>
### Testing

**Python signaling tests (`tests/signaling/`):**

| File | Tests | Coverage |
|------|-------|----------|
| `test_rooms.py` | ~20 | Room dataclass, RoomManager lifecycle, unique IDs (50-room stress test), session durations, event logging, admin summaries |
| `test_signaling_server.py` | ~21 | Full signaling flow (offer/answer/ICE relay), connection loss scenarios (initiator/joiner/both crash, disconnect during SDP), clean session teardown (leave+rejoin, 3x cycles), dashboard endpoints (status/events/rooms/peers) |

Uses `FakePeer` to simulate Socket.IO peers.

**JavaScript tests (`tests/js/`):**

| File | Tests | Coverage |
|------|-------|----------|
| `bb84/test_protocol.js` | ~6 | Full BB84 over ideal channel (matching 128-bit keys), sifting survival rate, QBER estimation, privacy amplification, high-QBER rejection, eavesdropper detection |
| `bb84/test_simulated.js` | ~4 | QBER < 5% without eavesdropper, QBER > 11% with eavesdropper, detection rate calculations, fiber attenuation |
| `test_crypto.js` | ~5 | Encrypt/decrypt round-trip, key index parsing, random IV, wrong-key failure, GCM tamper detection, large frame (50KB) |
| `test_metrics.js` | ~5 | Record/retrieve, rolling window, QBER threshold events, key budget watermark, subscription |
| `test_app_dom.js` | — | App UI rendering |
| `test_signaling.js` | — | SignalingClient event relay |

<a id="qvc-cicd"></a>
### CI/CD

**`.github/workflows/test.yml`** — 4 jobs:

| Job | Runtime | Timeout | Action |
|-----|---------|---------|--------|
| Python Lint | Python 3.11 | 5m | `ruff check signaling/ tests/signaling/` |
| Python Tests | Python 3.11 | 10m | `pytest tests/signaling/ -v --tb=short --timeout=60` |
| JS Tests | Node 20 | 10m | `npm install && npx vitest run` |
| Docker Build | — | 10m | Build `Dockerfile.server`, start container, `curl /admin/status` health check |

**`.github/workflows/deploy-pages.yml`:** Uploads `website/client` to GitHub Pages on push to main.

**`.github/workflows/render-diagrams.yml`:** Renders PlantUML diagrams from `docs/diagrams/*.puml` to SVG/PNG, commits with `[skip ci]`.

<a id="qvc-docker"></a>
### Docker

**Dockerfile.server:**
- Base: `python:3.12-slim`
- Installs curl for health checks
- Sets `SIO_ASYNC_MODE=eventlet`
- Entry: `python -m signaling.main`

**docker-compose.yml:**
- Service: `signaling`
- Port: `127.0.0.1:${QVC_SERVER_PORT}:${QVC_SERVER_PORT}`
- Health check: `curl -f http://localhost:${QVC_SERVER_PORT}/admin/status`

**Environment variables:**

| Variable | Default | Purpose |
|----------|---------|---------|
| `QVC_SERVER_REST_PORT` | 5050 | Signaling server port |
| `QVC_HOST` | `0.0.0.0` | Bind address |
| `QVC_DEBUG` | — | Enable DEBUG logging |

<a id="qvc-dependencies"></a>
### Dependencies

| Purpose | Package | Version |
|---------|---------|---------|
| Web framework | Flask | 3.0.3 |
| CORS | Flask-CORS | 5.0.1 |
| Socket.IO (Flask) | Flask-SocketIO | 5.3.6 |
| Socket.IO (core) | python-socketio | 5.11.2 |
| Async server | eventlet | 0.36.1 |
| Dev: tests | pytest | latest |
| Dev: mocks | pytest-mock | latest |
| Dev: coverage | pytest-cov | latest |
| JS: test runner | vitest | ^3.1.1 |
| JS: DOM | jsdom | ^26.1.0 |

**Ruff config (`ruff.toml`):** Line length 120, Python 3.11 target, ALL rules enabled with ~20 relaxations, Google docstring convention.
