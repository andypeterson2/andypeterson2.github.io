#!/usr/bin/env node
/**
 * Token build pipeline — generates CSS custom properties and TypeScript
 * constants from tokens.json source of truth.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tokens = JSON.parse(readFileSync(resolve(__dirname, '../src/tokens/tokens.json'), 'utf-8'));

function varName(category, name) {
  const prefixMap = {
    color: 'color',
    font: 'font',
    fontSize: 'text',
    space: 'space',
    typography: '',
  };
  const prefix = prefixMap[category];
  if (prefix === undefined) return `--${name}`;
  if (prefix === '') return `--${name}`;
  return `--${prefix}-${name}`;
}

// ── Generate CSS custom properties ──
function generateCSS(tokens) {
  const lines = [
    '/* ═══════════════════════════════════════════════════════════════════════════',
    '   Design Tokens — CSS Custom Properties',
    '   Monochrome-first palette per Design Language Spec.',
    '   Dark by default; light via data-theme="light".',
    '   Typography: IBM Plex Sans + IBM Plex Mono.',
    '   Auto-generated from tokens.json — do not edit manually.',
    '   ═══════════════════════════════════════════════════════════════════════════ */',
    '',
    ':root {',
  ];
  const lightLines = [];

  for (const [category, values] of Object.entries(tokens)) {
    lines.push(`  /* ── ${category} ── */`);
    for (const [name, def] of Object.entries(values)) {
      const vn = varName(category, name);
      lines.push(`  ${vn}: ${def.value};`);
      if (def.light) {
        lightLines.push(`  ${vn}: ${def.light};`);
      }
    }
  }

  lines.push('}', '');

  if (lightLines.length) {
    lines.push('/* ── Light theme ── */');
    lines.push("[data-theme='light'] {", ...lightLines, '}', '');
    lines.push('/* ── OS preference fallback ── */');
    lines.push('@media (prefers-color-scheme: light) {');
    lines.push('  :root:not([data-theme]) {');
    for (const l of lightLines) {
      lines.push('  ' + l);
    }
    lines.push('  }');
    lines.push('}', '');
  }

  lines.push('/* ── Reduced motion ── */');
  lines.push('@media (prefers-reduced-motion: reduce) {');
  lines.push('  *,');
  lines.push('  *::before,');
  lines.push('  *::after {');
  lines.push('    animation-duration: 0.01ms !important;');
  lines.push('    animation-iteration-count: 1 !important;');
  lines.push('    transition-duration: 0.01ms !important;');
  lines.push('  }');
  lines.push('}');

  return lines.join('\n') + '\n';
}

// ── Generate TypeScript constants ──
function generateTS(tokens) {
  const lines = [
    '/* Auto-generated from tokens.json — do not edit manually */',
    '',
    'export const tokens = {',
  ];

  for (const [category, values] of Object.entries(tokens)) {
    lines.push(`  ${category}: {`);
    for (const [name, def] of Object.entries(values)) {
      const key = name.includes('-') ? `'${name}'` : name;
      lines.push(`    ${key}: '${def.value}',`);
    }
    lines.push('  },');
  }

  lines.push('} as const;', '');
  return lines.join('\n');
}

const stylesDir = resolve(__dirname, '../src/styles');
const tokensDir = resolve(__dirname, '../src/tokens');
mkdirSync(stylesDir, { recursive: true });
mkdirSync(tokensDir, { recursive: true });

// Write CSS directly to src/styles/tokens.css (replaces hand-maintained file)
writeFileSync(resolve(stylesDir, 'tokens.css'), generateCSS(tokens));
writeFileSync(resolve(tokensDir, 'tokens.generated.css'), generateCSS(tokens));
writeFileSync(resolve(tokensDir, 'tokens.generated.ts'), generateTS(tokens));

console.log('Tokens built: styles/tokens.css, tokens.generated.css, tokens.generated.ts');
