import { describe, test, expect } from 'vitest';
import { tex, untex } from '../src/editor/lib/api';
import { SYMBOLS, GLYPH_BY_CMD, isPermitted } from '../src/editor/lib/symbols';

/**
 * The field-escaping contract (round-two item 18). The old scheme left LaTeX
 * syntax intact so fields could carry custom macros; macro support was removed, so
 * a field is now made injection- and breakage-proof: permitted symbol commands
 * become their Unicode glyph, EVERYTHING else is escaped to literal text.
 */
describe('tex — every LaTeX special is escaped', () => {
  test('the full special set maps to its literal form', () => {
    expect(tex('%')).toBe('\\%');
    expect(tex('&')).toBe('\\&');
    expect(tex('$')).toBe('\\$');
    expect(tex('#')).toBe('\\#');
    expect(tex('_')).toBe('\\_');
    expect(tex('{')).toBe('\\{');
    expect(tex('}')).toBe('\\}');
    expect(tex('~')).toBe('\\textasciitilde{}');
    expect(tex('^')).toBe('\\textasciicircum{}');
    expect(tex('\\')).toBe('\\textbackslash{}');
  });

  test('a lone backslash no longer slips through (the item-18 gap)', () => {
    // The old (?<!\\) lookbehind left a bare backslash unescaped; now it is escaped.
    expect(tex('a \\ b')).toBe('a \\textbackslash{} b');
  });

  test('prose specials in a real bullet', () => {
    expect(tex('Cut cost 40% for R&D; ~$2M budget')).toBe(
      'Cut cost 40\\% for R\\&D; \\textasciitilde{}\\$2M budget',
    );
  });

  test('backslash is not double-escaped', () => {
    // One pass: the `\` we emit in `\%` must not itself be re-escaped.
    expect(tex('50%')).toBe('50\\%');
    expect(tex('a_b_c')).toBe('a\\_b\\_c');
  });
});

describe('tex — permitted symbols become glyphs, the rest go literal', () => {
  test('a permitted command is substituted to its Unicode glyph', () => {
    expect(tex('scaling n \\rightarrow \\infty')).toBe('scaling n → ∞');
    expect(tex('\\alpha + \\beta = \\gamma')).toBe('α + β = γ');
    expect(tex('runtime \\leq O(n)')).toBe('runtime ≤ O(n)');
  });

  test('an UNKNOWN command becomes literal text, not live LaTeX', () => {
    expect(tex('\\foobar')).toBe('\\textbackslash{}foobar');
    // …so \textbf and friends are inert prose, not formatting.
    expect(tex('\\textbf{x}')).toBe('\\textbackslash{}textbf\\{x\\}');
  });

  test('a control word is matched whole — no prefix bleakage', () => {
    // \le is permitted, but \leftarrow is its own token and must not become "≤ftarrow".
    expect(tex('\\leftarrow')).toBe('←');
    expect(tex('\\leq')).toBe('≤');
    // an unknown longer word starting with a permitted prefix stays literal
    expect(tex('\\alphabet')).toBe('\\textbackslash{}alphabet');
  });

  test('trailing digits/text after a command survive', () => {
    expect(tex('\\alpha2')).toBe('α2');
    expect(tex('\\pm 5%')).toBe('± 5\\%');
  });
});

describe('tex — injection is closed by construction', () => {
  // Strip every escape sequence we legitimately emit (`\textbackslash{}`, `\%`, …);
  // any leftover backslash would be a RAW command that reached the compiler.
  const hasRawCommand = (out: string) =>
    out
      .replace(/\\textbackslash\{\}/g, '')
      .replace(/\\textasciitilde\{\}/g, '')
      .replace(/\\textasciicircum\{\}/g, '')
      .replace(/\\[{}%&$#_]/g, '')
      .includes('\\');

  test('a hostile command cannot reach the compiler', () => {
    const out = tex('\\input{/etc/passwd}');
    expect(out).toBe('\\textbackslash{}input\\{/etc/passwd\\}');
    expect(out).not.toContain('\\input'); // the command as a command is gone
    expect(hasRawCommand(out)).toBe(false);
  });

  test('the \\write18 shell escape is closed over too', () => {
    const out = tex('\\write18{rm -rf /}');
    expect(out).not.toContain('\\write18');
    expect(hasRawCommand(out)).toBe(false);
  });
});

describe('tex — Unicode passes straight through (xelatex renders it)', () => {
  test('glyphs a user types directly are untouched', () => {
    expect(tex('α → β, 25 °C, café')).toBe('α → β, 25 °C, café');
  });
});

describe('untex — reverses the escaping for display', () => {
  test('specials round-trip back to prose', () => {
    expect(untex('50\\%')).toBe('50%');
    expect(untex('R\\&D')).toBe('R&D');
    expect(untex('\\{a\\}')).toBe('{a}');
    expect(untex('\\textbackslash{}')).toBe('\\');
    expect(untex('\\textasciitilde{}')).toBe('~');
    expect(untex('\\textasciicircum{}')).toBe('^');
  });

  test('a glyph stored in the field shows as itself', () => {
    expect(untex('scaling n → ∞')).toBe('scaling n → ∞');
  });
});

describe('round-trip untex(tex(x)) === x for prose (no commands)', () => {
  const cases = [
    'Reduced p95 latency 40% for R&D',
    'C:\\Users\\andrew — a path with {braces} and a ~tilde and 2^10',
    'Johnson & Johnson · $2M · #1 ranked · a_b_c',
    'plain words, no specials at all',
  ];
  for (const c of cases) {
    test(JSON.stringify(c), () => {
      expect(untex(tex(c))).toBe(c);
    });
  }

  test('command input is NORMALIZED, not round-tripped (one-way by design)', () => {
    // \rightarrow becomes the glyph and stays the glyph — the canonical form.
    expect(untex(tex('a \\rightarrow b'))).toBe('a → b');
  });
});

describe('the allowlist table itself', () => {
  test('every command is a well-formed control word with a glyph', () => {
    for (const s of SYMBOLS) {
      expect(s.cmd).toMatch(/^\\[a-zA-Z]+$/);
      expect(s.glyph.length).toBeGreaterThan(0);
      expect(s.label.length).toBeGreaterThan(0);
    }
  });

  test('the lookup is keyed by the bare command name', () => {
    expect(GLYPH_BY_CMD.get('rightarrow')).toBe('→');
    expect(isPermitted('alpha')).toBe(true);
    expect(isPermitted('textbf')).toBe(false);
  });

  test('no duplicate command names', () => {
    const cmds = SYMBOLS.map((s) => s.cmd);
    expect(new Set(cmds).size).toBe(cmds.length);
  });
});
