/** Immutably move an array item from one index to another. */
export function move<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * The download name a compiled resume carries: `YYYY-MM-DD-NAME-VARIANT.pdf`.
 * Each part is reduced to letters, digits and dashes so the name survives every
 * filesystem, and an empty part is dropped rather than leaving a double dash.
 * Composed (NFC) so an accented letter stays one letter: decomposing first would
 * split the accent off and the strip would then eat it, keeping some and not others.
 */
export function pdfFileName(name: string, variant: string, now = new Date()): string {
  const day = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
  const slug = (part: string) =>
    part
      .normalize('NFC')
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '');
  return [day, slug(name), slug(variant)].filter(Boolean).join('-') + '.pdf';
}
