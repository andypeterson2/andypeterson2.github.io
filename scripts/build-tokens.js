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

// ── Generate CSS custom properties ──
function generateCSS(tokens) {
  const lines = [
    '/* Auto-generated from tokens.json — do not edit manually */',
    '',
    ':root {',
  ];
  const lightLines = [];

  for (const [category, values] of Object.entries(tokens)) {
    lines.push(`  /* ── ${category} ── */`);
    for (const [name, def] of Object.entries(values)) {
      const prefix = category === 'layout' || category === 'motion' ? '' : `${category === 'color' ? 'color' : category === 'font' ? 'font' : category === 'fontSize' ? 'text' : category === 'space' ? 'space' : ''}-`;
      const varName = prefix ? `--${prefix}${name}` : `--${name}`;
      lines.push(`  ${varName}: ${def.value};`);
      if (def.light) {
        lightLines.push(`  ${varName}: ${def.light};`);
      }
    }
  }

  lines.push('}', '');

  if (lightLines.length) {
    lines.push('[data-theme="light"] {', ...lightLines, '}', '');
  }

  return lines.join('\n');
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

const outDir = resolve(__dirname, '../src/tokens');
mkdirSync(outDir, { recursive: true });

writeFileSync(resolve(outDir, 'tokens.generated.css'), generateCSS(tokens));
writeFileSync(resolve(outDir, 'tokens.generated.ts'), generateTS(tokens));

console.log('Tokens built: tokens.generated.css, tokens.generated.ts');
