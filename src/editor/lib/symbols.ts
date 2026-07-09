// The permitted-symbol allowlist — the single source of truth for what LaTeX a
// field may contain. It powers three things: the escape transform (api.ts `tex`
// substitutes these commands to their glyph and escapes everything else), the
// "what you can use" palette, and the "unrecognized command" warning (increment 2).
//
// The design (see the round-two register, item 18): the compiler is xelatex,
// which renders Unicode natively — so the escape target is LaTeX *syntax*, not
// *symbols*. A permitted `\command` is translated to its Unicode glyph before any
// escaping, so the compiler never sees a raw control word from a field: a token is
// either a known-safe glyph or escaped to literal text. Injection-proof by
// construction, and `\rightarrow`-style muscle memory keeps working (it just
// normalizes to → on the way in).
//
// To permit a new symbol, add a row. Keep `cmd` the exact control word a LaTeX
// user would type; `glyph` must be a character xelatex's font can render.

export interface SymbolDef {
  /** the control word as typed, with backslash — e.g. '\\rightarrow' */
  cmd: string;
  /** the Unicode glyph it maps to */
  glyph: string;
  /** human label for the palette */
  label: string;
  category: 'Arrows' | 'Relations' | 'Operators' | 'Set & logic' | 'Greek' | 'Misc';
}

export const SYMBOLS: SymbolDef[] = [
  // Arrows
  { cmd: '\\rightarrow', glyph: '→', label: 'right arrow', category: 'Arrows' },
  { cmd: '\\to', glyph: '→', label: 'to', category: 'Arrows' },
  { cmd: '\\leftarrow', glyph: '←', label: 'left arrow', category: 'Arrows' },
  { cmd: '\\leftrightarrow', glyph: '↔', label: 'left-right arrow', category: 'Arrows' },
  { cmd: '\\Rightarrow', glyph: '⇒', label: 'implies', category: 'Arrows' },
  { cmd: '\\uparrow', glyph: '↑', label: 'up arrow', category: 'Arrows' },
  { cmd: '\\downarrow', glyph: '↓', label: 'down arrow', category: 'Arrows' },
  { cmd: '\\mapsto', glyph: '↦', label: 'maps to', category: 'Arrows' },

  // Relations
  { cmd: '\\leq', glyph: '≤', label: 'less-or-equal', category: 'Relations' },
  { cmd: '\\le', glyph: '≤', label: 'less-or-equal', category: 'Relations' },
  { cmd: '\\geq', glyph: '≥', label: 'greater-or-equal', category: 'Relations' },
  { cmd: '\\ge', glyph: '≥', label: 'greater-or-equal', category: 'Relations' },
  { cmd: '\\neq', glyph: '≠', label: 'not-equal', category: 'Relations' },
  { cmd: '\\approx', glyph: '≈', label: 'approximately', category: 'Relations' },
  { cmd: '\\equiv', glyph: '≡', label: 'equivalent', category: 'Relations' },
  { cmd: '\\propto', glyph: '∝', label: 'proportional', category: 'Relations' },
  { cmd: '\\sim', glyph: '∼', label: 'similar', category: 'Relations' },
  { cmd: '\\ll', glyph: '≪', label: 'much less', category: 'Relations' },
  { cmd: '\\gg', glyph: '≫', label: 'much greater', category: 'Relations' },

  // Operators
  { cmd: '\\times', glyph: '×', label: 'times', category: 'Operators' },
  { cmd: '\\div', glyph: '÷', label: 'divide', category: 'Operators' },
  { cmd: '\\pm', glyph: '±', label: 'plus-minus', category: 'Operators' },
  { cmd: '\\mp', glyph: '∓', label: 'minus-plus', category: 'Operators' },
  { cmd: '\\cdot', glyph: '·', label: 'centre dot', category: 'Operators' },
  { cmd: '\\ast', glyph: '∗', label: 'asterisk', category: 'Operators' },
  { cmd: '\\star', glyph: '⋆', label: 'star', category: 'Operators' },
  { cmd: '\\circ', glyph: '∘', label: 'ring', category: 'Operators' },
  { cmd: '\\sqrt', glyph: '√', label: 'square root', category: 'Operators' },
  { cmd: '\\sum', glyph: '∑', label: 'sum', category: 'Operators' },
  { cmd: '\\prod', glyph: '∏', label: 'product', category: 'Operators' },
  { cmd: '\\int', glyph: '∫', label: 'integral', category: 'Operators' },
  { cmd: '\\partial', glyph: '∂', label: 'partial', category: 'Operators' },
  { cmd: '\\nabla', glyph: '∇', label: 'nabla', category: 'Operators' },
  { cmd: '\\infty', glyph: '∞', label: 'infinity', category: 'Operators' },

  // Set & logic
  { cmd: '\\in', glyph: '∈', label: 'element of', category: 'Set & logic' },
  { cmd: '\\notin', glyph: '∉', label: 'not element of', category: 'Set & logic' },
  { cmd: '\\subset', glyph: '⊂', label: 'subset', category: 'Set & logic' },
  { cmd: '\\subseteq', glyph: '⊆', label: 'subset-or-equal', category: 'Set & logic' },
  { cmd: '\\cup', glyph: '∪', label: 'union', category: 'Set & logic' },
  { cmd: '\\cap', glyph: '∩', label: 'intersection', category: 'Set & logic' },
  { cmd: '\\forall', glyph: '∀', label: 'for all', category: 'Set & logic' },
  { cmd: '\\exists', glyph: '∃', label: 'there exists', category: 'Set & logic' },
  { cmd: '\\neg', glyph: '¬', label: 'not', category: 'Set & logic' },
  { cmd: '\\wedge', glyph: '∧', label: 'and', category: 'Set & logic' },
  { cmd: '\\vee', glyph: '∨', label: 'or', category: 'Set & logic' },
  { cmd: '\\emptyset', glyph: '∅', label: 'empty set', category: 'Set & logic' },

  // Greek (lowercase)
  { cmd: '\\alpha', glyph: 'α', label: 'alpha', category: 'Greek' },
  { cmd: '\\beta', glyph: 'β', label: 'beta', category: 'Greek' },
  { cmd: '\\gamma', glyph: 'γ', label: 'gamma', category: 'Greek' },
  { cmd: '\\delta', glyph: 'δ', label: 'delta', category: 'Greek' },
  { cmd: '\\epsilon', glyph: 'ε', label: 'epsilon', category: 'Greek' },
  { cmd: '\\theta', glyph: 'θ', label: 'theta', category: 'Greek' },
  { cmd: '\\lambda', glyph: 'λ', label: 'lambda', category: 'Greek' },
  { cmd: '\\mu', glyph: 'μ', label: 'mu', category: 'Greek' },
  { cmd: '\\pi', glyph: 'π', label: 'pi', category: 'Greek' },
  { cmd: '\\rho', glyph: 'ρ', label: 'rho', category: 'Greek' },
  { cmd: '\\sigma', glyph: 'σ', label: 'sigma', category: 'Greek' },
  { cmd: '\\tau', glyph: 'τ', label: 'tau', category: 'Greek' },
  { cmd: '\\phi', glyph: 'φ', label: 'phi', category: 'Greek' },
  { cmd: '\\chi', glyph: 'χ', label: 'chi', category: 'Greek' },
  { cmd: '\\psi', glyph: 'ψ', label: 'psi', category: 'Greek' },
  { cmd: '\\omega', glyph: 'ω', label: 'omega', category: 'Greek' },
  { cmd: '\\Gamma', glyph: 'Γ', label: 'capital gamma', category: 'Greek' },
  { cmd: '\\Delta', glyph: 'Δ', label: 'capital delta', category: 'Greek' },
  { cmd: '\\Theta', glyph: 'Θ', label: 'capital theta', category: 'Greek' },
  { cmd: '\\Lambda', glyph: 'Λ', label: 'capital lambda', category: 'Greek' },
  { cmd: '\\Pi', glyph: 'Π', label: 'capital pi', category: 'Greek' },
  { cmd: '\\Sigma', glyph: 'Σ', label: 'capital sigma', category: 'Greek' },
  { cmd: '\\Phi', glyph: 'Φ', label: 'capital phi', category: 'Greek' },
  { cmd: '\\Omega', glyph: 'Ω', label: 'capital omega', category: 'Greek' },

  // Misc typographic
  { cmd: '\\ldots', glyph: '…', label: 'ellipsis', category: 'Misc' },
  { cmd: '\\dots', glyph: '…', label: 'ellipsis', category: 'Misc' },
  { cmd: '\\degree', glyph: '°', label: 'degree', category: 'Misc' },
  { cmd: '\\bullet', glyph: '•', label: 'bullet', category: 'Misc' },
  { cmd: '\\dagger', glyph: '†', label: 'dagger', category: 'Misc' },
  { cmd: '\\S', glyph: '§', label: 'section', category: 'Misc' },
  { cmd: '\\copyright', glyph: '©', label: 'copyright', category: 'Misc' },
  { cmd: '\\pounds', glyph: '£', label: 'pounds', category: 'Misc' },
];

/** bare control word (no backslash) → glyph, for the escape transform's lookup. */
export const GLYPH_BY_CMD: Map<string, string> = new Map(
  SYMBOLS.map((s) => [s.cmd.slice(1), s.glyph]),
);

/** Is `\name` (pass the bare `name`) a permitted symbol command? */
export function isPermitted(name: string): boolean {
  return GLYPH_BY_CMD.has(name);
}
