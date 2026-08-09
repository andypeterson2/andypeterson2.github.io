// Off-script claude.ai/design layout generator for a Web Components library.
// Produces ds-bundle/: the compiled bundle, a self-contained styles.css closure
// (system.css vendored), and per-component preview card + .prompt.md + .d.ts.
// The converter's happy path is React; this hand-produces the same output shape.
import { mkdir, writeFile, copyFile, rm } from 'node:fs/promises';

const OUT = 'ds-bundle';
const SYSTEM_CSS = 'https://unpkg.com/@sakun/system.css@0.1.11/dist/system.css';

// A self-contained 1-bit glyph for the finder-icon examples (no external asset).
const GLYPH =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 4 4' fill='%23000'%3E%3Crect width='1.6' height='1.6'/%3E%3Crect x='2.4' width='1.6' height='1.6'/%3E%3Crect y='2.4' width='1.6' height='1.6'/%3E%3Crect x='2.4' y='2.4' width='1.6' height='1.6'/%3E%3C/svg%3E";

const COMPONENTS = [
  {
    name: 'Window', tag: 's6-window', group: 'Chrome', w: 460, h: 220,
    blurb: 'A System 6 window — title bar, optional details bar, and a body your content projects into.',
    attrs: [['title', 'string', 'text shown in the title bar'], ['details', 'string?', 'optional details-bar text']],
    example: `<s6-window title="Panel" details="/ status">\n  <s6-section-rule>Health</s6-section-rule>\n  <p>Body content projects into the window.</p>\n  <s6-status state="success" label="Connected"></s6-status>\n</s6-window>`,
  },
  {
    name: 'Button', tag: 's6-button', group: 'Chrome', w: 300, h: 90,
    blurb: 'A push button. Emits system.css `.btn`.',
    attrs: [['disabled', 'boolean?', 'present = disabled']],
    example: `<s6-button>OK</s6-button>\n<s6-button disabled>Disabled</s6-button>`,
  },
  {
    name: 'SectionRule', tag: 's6-section-rule', group: 'Chrome', w: 420, h: 70,
    blurb: 'A centered uppercase label between hairlines — structure without color (L5).',
    attrs: [],
    example: `<s6-section-rule>How it works</s6-section-rule>`,
  },
  {
    name: 'IconGrid', tag: 's6-icon-grid', group: 'Chrome', w: 460, h: 170,
    blurb: 'The Finder desktop — a responsive grid of icons (L7).',
    attrs: [],
    example: `<s6-icon-grid>\n  <s6-finder-icon src="${GLYPH}" label="Alpha" href="#"></s6-finder-icon>\n  <s6-finder-icon src="${GLYPH}" label="Beta" href="#"></s6-finder-icon>\n  <s6-finder-icon src="${GLYPH}" label="Gamma" href="#"></s6-finder-icon>\n</s6-icon-grid>`,
  },
  {
    name: 'FinderIcon', tag: 's6-finder-icon', group: 'Chrome', w: 200, h: 150,
    blurb: 'A single Finder icon — a 1-bit glyph over a label, invert-on-hover.',
    attrs: [['src', 'string', 'glyph URL (1-bit SVG so it inverts with the theme)'], ['label', 'string', 'caption'], ['href', 'string?', 'link target']],
    example: `<s6-finder-icon src="${GLYPH}" label="Nonogram" href="#"></s6-finder-icon>`,
  },
  {
    name: 'Dither', tag: 's6-dither', group: 'Signal', w: 460, h: 130,
    blurb: 'A 1-bit dithered fill — the honest System 6 gray (L2). Size the element; the fill fills it. `light` is the only density safe behind text.',
    attrs: [['density', "'light'|'25'|'50'|'75'|'hatch'", 'ordered dither density']],
    example: `<s6-dither density="light" style="display:inline-block;width:90px;height:48px;border:2px solid var(--color-border)"></s6-dither>\n<s6-dither density="25" style="display:inline-block;width:90px;height:48px;border:2px solid var(--color-border)"></s6-dither>\n<s6-dither density="50" style="display:inline-block;width:90px;height:48px;border:2px solid var(--color-border)"></s6-dither>\n<s6-dither density="hatch" style="display:inline-block;width:90px;height:48px;border:2px solid var(--color-border)"></s6-dither>`,
  },
  {
    name: 'Status', tag: 's6-status', group: 'Signal', w: 460, h: 90,
    blurb: 'The status light — a colored dot + label. The ONLY place a hue appears (L3); reactive to state changes (L6).',
    attrs: [['state', "'success'|'warning'|'danger'|'idle'", 'which status token colors the dot'], ['label', 'string', 'text']],
    example: `<s6-status state="success" label="Connected"></s6-status>\n<s6-status state="warning" label="Degraded"></s6-status>\n<s6-status state="danger" label="Compromised"></s6-status>\n<s6-status state="idle" label="Idle"></s6-status>`,
  },
  {
    name: 'ThemeToggle', tag: 's6-theme-toggle', group: 'Signal', w: 200, h: 90,
    blurb: 'The dark-mode control (L4). Flips data-theme on <html> and persists; the page inverts via one filter.',
    attrs: [],
    example: `<s6-theme-toggle></s6-theme-toggle>`,
  },
];

const card = (c) => `<!-- @dsCard group="${c.group}" -->
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<link rel="stylesheet" href="../../../styles.css" />
<script src="../../../_ds_bundle.js"></script>
<style>body{margin:0;padding:20px;background:#fff;font-family:var(--font-sans)}.ex{display:flex;gap:14px;flex-wrap:wrap;align-items:center}</style>
</head>
<body>
<div class="ex">
${c.example}
</div>
</body>
</html>
`;

const prompt = (c) => `# <${c.tag}>

${c.blurb}

## Attributes
${c.attrs.length ? c.attrs.map(([n, t, d]) => `- \`${n}\` (${t}) — ${d}`).join('\n') : '_None._'}

## Usage
\`\`\`html
${c.example}
\`\`\`

## Rules (from the design system)
- Load \`styles.css\` and \`_ds_bundle.js\`; the element registers itself and is styled by the closure.
- Color appears only via \`<s6-status>\`; everything else is 1-bit black/white.
- Grays are \`<s6-dither>\`, never flat. \`light\` is the only density readable behind text.
`;

const dts = (c) => `// Attribute contract for <${c.tag}> (a custom element).
export interface ${c.name}Attributes {
${c.attrs.map(([n, t]) => `  /** ${n} */\n  ${n.replace(/[^a-z]/gi, '')}${t.includes('?') ? '?' : ''}: ${t.replace('?', '').replace(/'/g, '"')};`).join('\n') || '  // no attributes'}
}
`;

// ── generate ──
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

// styles closure: vendor system.css, copy the design layer, write styles.css
const sys = await (await fetch(SYSTEM_CSS)).text();
await writeFile(`${OUT}/system.css`, sys);
for (const f of ['tokens.css', 'base.css', 'dither.css', 'elements.css']) {
  await copyFile(`styles/${f}`, `${OUT}/${f}`);
}
await writeFile(
  `${OUT}/styles.css`,
  `/* system-six — self-contained closure for claude.ai/design. */\n@import './system.css';\n@import './tokens.css';\n@import './base.css';\n@import './dither.css';\n@import './elements.css';\n`,
);

// the bundle (IIFE, registers the elements, exposes window.SystemSix)
const bundle = await (await import('node:fs/promises')).readFile('dist/system-six.global.js', 'utf-8');
await writeFile(`${OUT}/_ds_bundle.js`, `/* @ds-bundle system-six — window.SystemSix + custom elements */\n${bundle}`);

// per-component
for (const c of COMPONENTS) {
  const dir = `${OUT}/components/${c.group}/${c.name}`;
  await mkdir(dir, { recursive: true });
  await writeFile(`${dir}/index.html`, card(c));
  await writeFile(`${dir}/${c.name}.prompt.md`, prompt(c));
  await writeFile(`${dir}/${c.name}.d.ts`, dts(c));
}

// README — the conventions doc is the agent-facing header
const conv = await (await import('node:fs/promises')).readFile('../../docs/design-system.md', 'utf-8');
await writeFile(
  `${OUT}/README.md`,
  `${conv}\n\n---\n\n## Components in this project\n\n${COMPONENTS.map((c) => `- **<${c.tag}>** (${c.group}) — ${c.blurb}`).join('\n')}\n`,
);

console.log(`ds-bundle: ${COMPONENTS.length} components + bundle + styles closure`);
