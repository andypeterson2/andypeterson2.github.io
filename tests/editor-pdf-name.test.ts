import { describe, test, expect } from 'vitest';
import { pdfFileName } from '../src/editor/lib/util';

// The download name a compiled resume carries: YYYY-MM-DD-NAME-VARIANT.pdf.
describe('pdfFileName', () => {
  const day = new Date(2026, 9, 8); // 8 October 2026, local time

  test('dates the file, then names whose resume and which variant', () => {
    expect(pdfFileName('Ada Lovelace', 'Full CV', day)).toBe('2026-10-08-Ada-Lovelace-Full-CV.pdf');
  });

  test('pads a single-digit month and day', () => {
    expect(pdfFileName('Ada', 'Main', new Date(2026, 0, 3))).toBe('2026-01-03-Ada-Main.pdf');
  });

  test('reduces anything a filesystem might not keep to dashes', () => {
    expect(pdfFileName('Ada  Lovelace, PhD', 'Q4 / 2026 (draft)', day)).toBe(
      '2026-10-08-Ada-Lovelace-PhD-Q4-2026-draft.pdf',
    );
  });

  test('keeps letters beyond ASCII rather than stripping the name away', () => {
    expect(pdfFileName('Ada Łowelacé', 'Main', day)).toBe('2026-10-08-Ada-Łowelacé-Main.pdf');
  });

  test('drops an empty part instead of leaving a gap in the name', () => {
    expect(pdfFileName('', 'Main', day)).toBe('2026-10-08-Main.pdf');
    expect(pdfFileName('Ada', '', day)).toBe('2026-10-08-Ada.pdf');
    expect(pdfFileName('', '', day)).toBe('2026-10-08.pdf');
  });
});
