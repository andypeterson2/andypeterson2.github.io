/**
 * The one place the site builds gateway URLs. The sign-in URL is shared by the menu
 * bar and the editor, so a visitor comes back to the page they left from either one.
 */
import { describe, test, expect } from 'vitest';
import { GATEWAY_ORIGIN, gatewayOriginOf, loginUrl } from '../src/lib/gateway';

describe('gatewayOriginOf', () => {
  test('keeps the origin of an app base and drops its prefix', () => {
    expect(gatewayOriginOf('https://api.example.dev/cv')).toBe('https://api.example.dev');
  });

  test('falls back to the front door for an unset or unparseable base', () => {
    expect(gatewayOriginOf(undefined)).toBe(GATEWAY_ORIGIN);
    expect(gatewayOriginOf('')).toBe(GATEWAY_ORIGIN);
    expect(gatewayOriginOf('not a url')).toBe(GATEWAY_ORIGIN);
  });
});

describe('loginUrl', () => {
  test('returns the browser to where it started', () => {
    const url = new URL(loginUrl('https://api.example.dev', 'https://site.dev/editor/'));
    expect(url.origin + url.pathname).toBe('https://api.example.dev/auth/login');
    expect(url.searchParams.get('redirect')).toBe('https://site.dev/editor/');
  });

  test('a redirect carrying a query survives the round trip', () => {
    const back = 'https://site.dev/app/?variant=2&tab=tags';
    const url = new URL(loginUrl(GATEWAY_ORIGIN, back));
    // Encoded, so the gateway reads one parameter rather than three.
    expect(url.search).toContain(encodeURIComponent(back));
    expect(url.searchParams.get('redirect')).toBe(back);
  });
});
