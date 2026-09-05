// The Socket.IO client stays a vendored classic script
// (/vendor/socket.io-4.7.5.min.js, pinned to the backend's socket.io family
// and loaded by the nonogram page before this bundle), so `io` is a global.
// Minimal surface — only what app.ts uses.

interface NonogramSocket {
  connected: boolean;
  disconnect(): void;
  /** Payloads are backend-defined; callers narrow them at the handler. */
  on(event: string, cb: (payload?: unknown) => void): void;
}

interface NonogramSocketOptions {
  /** engine.io endpoint path — '/nonogram/socket.io' when riding the gateway. */
  path?: string;
  /** extra query params on every transport request (the recruiter pass). */
  query?: Record<string, string>;
}

declare const io: (url: string, opts?: NonogramSocketOptions) => NonogramSocket;
