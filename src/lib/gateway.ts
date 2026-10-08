/**
 * The single API front door.
 *
 * Sessions, entitlement and the telemetry sink all answer at this origin's root, while
 * each backend is mounted under its own prefix beneath it. Anything asking the root
 * must use the origin rather than an app's base — `window.API_BASE` already carries a
 * prefix, and a request built from it lands on a path no upstream serves.
 */
export const GATEWAY_ORIGIN = 'https://api.andypeterson.dev';

/** The origin behind an app base, falling back to the front door itself. */
export function gatewayOriginOf(appBase: string | undefined): string {
  try {
    return new URL(appBase || GATEWAY_ORIGIN).origin;
  } catch {
    return GATEWAY_ORIGIN;
  }
}

/**
 * The gateway's full-page Google sign-in, returning the browser to `redirect`.
 * One builder for every caller: the menu bar and the editor sign in the same way.
 */
export function loginUrl(origin: string, redirect: string): string {
  return `${origin}/auth/login?redirect=${encodeURIComponent(redirect)}`;
}
