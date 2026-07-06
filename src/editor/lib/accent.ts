// The Awesome-CV accent palette + a resolver. Shared by the Style drawer (the
// swatch picker) and the store (which derives the hex the document themes with).
export interface AccentColor {
  key: string;
  hex: string;
  label: string;
}

export const ACCENT_COLORS: AccentColor[] = [
  { key: 'awesome-emerald', hex: '#00a388', label: 'Emerald' },
  { key: 'awesome-skyblue', hex: '#0395de', label: 'Sky Blue' },
  { key: 'awesome-red', hex: '#dc3522', label: 'Red' },
  { key: 'awesome-pink', hex: '#ef4089', label: 'Pink' },
  { key: 'awesome-orange', hex: '#ff6138', label: 'Orange' },
  { key: 'awesome-nephritis', hex: '#27ae60', label: 'Nephritis' },
  { key: 'awesome-concrete', hex: '#95a5a6', label: 'Concrete' },
  { key: 'awesome-darknight', hex: '#131a28', label: 'Dark Night' },
  { key: 'spinel', hex: '#b21f5c', label: 'Spinel' },
];

const INK = '#1c1b19';

/** Resolve a stored accent (a palette key, or 'custom' + a hex) to a hex. */
export function resolveAccent(accentColor: string, customHex: string): string {
  if (accentColor === 'custom') {
    const hex = customHex.trim();
    return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : INK;
  }
  return ACCENT_COLORS.find((c) => c.key === accentColor)?.hex ?? INK;
}
