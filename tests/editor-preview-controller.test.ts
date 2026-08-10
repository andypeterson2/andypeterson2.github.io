import { vi, describe, test, expect, beforeEach } from 'vitest';

vi.mock('../src/editor/lib/api', () => ({
  api: { compilePdf: vi.fn(), compileMainPdf: vi.fn() },
}));

import { api } from '../src/editor/lib/api';
import { PreviewController } from '../src/editor/lib/preview.svelte';
import type { Variant } from '../src/editor/lib/types';

const variant = (id = 1): Variant => ({
  id,
  name: 'V',
  kind: 'cv',
  rules: { include: [], exclude: [] },
  sections: [],
});

// The controller takes three thunks (connected, active variant, active person id).
// This wraps plain values so each test reads its scenario at a glance.
const make = (
  connected: boolean,
  activeVariant: Variant | null,
  activePersonId: number | null = null,
) =>
  new PreviewController(
    () => connected,
    () => activeVariant,
    () => activePersonId,
  );

// URL.createObjectURL / revokeObjectURL are browser-only; the controller uses them
// to hold the compiled PDF, so stub them for the node test env.
beforeEach(() => {
  vi.clearAllMocks();
  (URL as unknown as { createObjectURL: unknown }).createObjectURL = vi.fn(() => 'blob:fake');
  (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn();
});

describe('PreviewController', () => {
  test('toggle flips the pane open/closed', () => {
    const p = make(true, null);
    expect(p.open).toBe(false);
    p.toggle();
    expect(p.open).toBe(true);
    p.toggle();
    expect(p.open).toBe(false);
  });

  test('compilable needs a live backend AND something to compile (a variant or a profile)', () => {
    // Offline: never, whatever is loaded.
    expect(make(false, variant()).compilable).toBe(false);
    expect(make(false, null, 3).compilable).toBe(false);
    // Connected but nothing loaded (no variant, no profile): no.
    expect(make(true, null, null).compilable).toBe(false);
    // Connected with an active variant: yes.
    expect(make(true, variant()).compilable).toBe(true);
    // Connected on Main (no variant) with a loaded profile: yes — compiles the full doc.
    expect(make(true, null, 3).compilable).toBe(true);
  });

  test('compile is a no-op offline, or connected with nothing loaded', async () => {
    const offline = make(false, variant(), 3);
    await offline.compile();
    expect(api.compilePdf).not.toHaveBeenCalled();
    expect(api.compileMainPdf).not.toHaveBeenCalled();
    expect(offline.state).toBe('idle');

    const empty = make(true, null, null);
    await empty.compile();
    expect(api.compilePdf).not.toHaveBeenCalled();
    expect(api.compileMainPdf).not.toHaveBeenCalled();
    expect(empty.state).toBe('idle');
  });

  test('compile of an active variant → compilePdf(variant id), holding its object URL', async () => {
    (api.compilePdf as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      data: new Blob(['%PDF']),
    });
    const p = make(true, variant(7), 3);
    await p.compile();
    expect(api.compilePdf).toHaveBeenCalledWith(7);
    expect(api.compileMainPdf).not.toHaveBeenCalled();
    expect(p.state).toBe('ready');
    expect(p.url).toBe('blob:fake');
  });

  test('compile on Main (no variant) → compileMainPdf(person id)', async () => {
    (api.compileMainPdf as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      data: new Blob(['%PDF']),
    });
    const p = make(true, null, 42);
    await p.compile();
    expect(api.compileMainPdf).toHaveBeenCalledWith(42);
    expect(api.compilePdf).not.toHaveBeenCalled();
    expect(p.state).toBe('ready');
    expect(p.url).toBe('blob:fake');
  });

  test('compile failure → error state with the compiler log', async () => {
    (api.compilePdf as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      error: { message: 'Undefined control sequence' },
    });
    const p = make(true, variant(), 3);
    await p.compile();
    expect(p.state).toBe('error');
    expect(p.log).toBe('Undefined control sequence');
  });

  test('reset drops the compiled PDF and revokes its object URL', () => {
    const p = make(true, variant(), 3);
    (p as unknown as { url: string }).url = 'blob:fake';
    p.reset();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
    expect(p.url).toBe(null);
    expect(p.state).toBe('idle');
  });
});
