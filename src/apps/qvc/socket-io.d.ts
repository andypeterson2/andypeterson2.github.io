// The Socket.IO client stays a vendored classic script (4.8.4, pinned to the
// signalling backend's socket.io family) loaded before this bundle, so `io` is a
// global. Minimal surface — only what the call uses.

interface QvcSocket {
  connected: boolean;
  disconnect(): void;
  /** Payloads are backend-defined; callers narrow them at the handler. */
  on(event: string, cb: (payload?: unknown) => void): void;
  emit(event: string, payload?: unknown): void;
}

interface QvcSocketOptions {
  /** engine.io endpoint path — '/qvc/socket.io' when riding the gateway. */
  path?: string;
  /** The relay is WebSocket-only; polling would be refused. */
  transports?: string[];
  /** Extra query params on every transport request (the recruiter pass). */
  query?: Record<string, string>;
}

declare const io: (url: string, opts?: QvcSocketOptions) => QvcSocket;
