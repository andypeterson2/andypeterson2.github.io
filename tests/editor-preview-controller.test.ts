import { vi, describe, test, expect, beforeEach } from 'vitest';

vi.mock('../src/editor/lib/api', () => ({ api: { compilePdf: vi.fn() } }));

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

// URL.createObjectURL / revokeObjectURL are browser-only; the controller uses them
// to hold the compiled PDF, so stub them for the node test env.
beforeEach(() => {
  vi.clearAllMocks();
  (URL as unknown as { createObjectURL: unknown }).createObjectURL = vi.fn(() => 'blob:fake');
  (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn();
});

describe('PreviewController', () => {
  test('toggle flips the pane open/closed', () => {
    const p = new PreviewController(
      () => true,
      () => null,
    );
    expect(p.open).toBe(false);
    p.toggle();
    expect(p.open).toBe(true);
    p.toggle();
    expect(p.open).toBe(false);
  });

  test('compilable requires BOTH a live backend and an active variant', () => {
    expect(new PreviewController(() => false, () => variant()).compilable).toBe(false);
    expect(new PreviewController(() => true, () => null).compilable).toBe(false);
    expect(new PreviewController(() => true, () => variant()).compilable).toBe(true);
  });

  test('compile is a no-op offline or with no variant', async () => {
    const p = new PreviewController(
      () => false,
      () => variant(),
    );
    await p.compile();
    expect(api.compilePdf).not.toHaveBeenCalled();
    expect(p.state).toBe('idle');
  });

  test('compile success → ready, holding an object URL for the active variant', async () => {
    (api.compilePdf as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      data: new Blob(['%PDF']),
    });
    const p = new PreviewController(
      () => true,
      () => variant(7),
    );
    await p.compile();
    expect(api.compilePdf).toHaveBeenCalledWith(7);
    expect(p.state).toBe('ready');
    expect(p.url).toBe('blob:fake');
  });

  test('compile failure → error state with the compiler log', async () => {
    (api.compilePdf as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      error: { message: 'Undefined control sequence' },
    });
    const p = new PreviewController(
      () => true,
      () => variant(),
    );
    await p.compile();
    expect(p.state).toBe('error');
    expect(p.log).toBe('Undefined control sequence');
  });

  test('reset drops the compiled PDF and revokes its object URL', () => {
    const p = new PreviewController(
      () => true,
      () => variant(),
    );
    (p as unknown as { url: string }).url = 'blob:fake';
    p.reset();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
    expect(p.url).toBe(null);
    expect(p.state).toBe('idle');
  });
});
