## CV Editor

**Source repo:** [`andypeterson2/cv`](https://github.com/andypeterson2/cv) — API-only backend. The portal owns the frontend under `public/cv/`.

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
