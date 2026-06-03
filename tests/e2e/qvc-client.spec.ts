import { test, expect, type Page } from '@playwright/test';

/**
 * Mock the Socket.IO CDN script with a stub that captures events.
 * Also mock fetch() for the health check so connectionManager.connect() proceeds.
 */
const SOCKETIO_STUB = `
(function() {
  // Minimal Socket.IO mock
  function MockSocket(url, opts) {
    this._url = url;
    this._handlers = {};
    this._emitted = [];
    this.connected = false;
    this.id = 'mock-socket-id';
  }
  MockSocket.prototype.on = function(event, fn) {
    if (!this._handlers[event]) this._handlers[event] = [];
    this._handlers[event].push(fn);
    return this;
  };
  MockSocket.prototype.emit = function(event) {
    var args = Array.prototype.slice.call(arguments, 1);
    this._emitted.push({ event: event, args: args });
    return this;
  };
  MockSocket.prototype.connect = function() {
    this.connected = true;
    this._fire('connect');
    return this;
  };
  MockSocket.prototype.disconnect = function() {
    this.connected = false;
    return this;
  };
  MockSocket.prototype.off = function() { return this; };
  MockSocket.prototype.removeAllListeners = function() { return this; };
  MockSocket.prototype._fire = function(event) {
    var args = Array.prototype.slice.call(arguments, 1);
    var fns = this._handlers[event] || [];
    for (var i = 0; i < fns.length; i++) fns[i].apply(null, args);
  };

  window.__mockSockets = [];
  window.io = function(url, opts) {
    var s = new MockSocket(url, opts);
    window.__mockSockets.push(s);
    // Also set as connectionSocket for app.js
    window.connectionSocket = s;
    return s;
  };
  window.io.connect = window.io;
})();
`;

async function setupMocks(page: Page) {
  // Inject the mock BEFORE any page scripts run (bypasses SRI)
  await page.addInitScript(SOCKETIO_STUB);

  // Headless browsers have no camera/mic. Stub getUserMedia so the connect flow
  // (navbar:connect → getLocalMedia → connectToSignaling → io()) can proceed and
  // the socket event handlers are actually registered + exercised.
  await page.addInitScript(() => {
    const fake = () => {
      const c = document.createElement('canvas');
      c.width = 320;
      c.height = 240;
      c.getContext('2d');
      return c.captureStream(5);
    };
    if (navigator.mediaDevices) {
      navigator.mediaDevices.getUserMedia = async () => fake();
    }
  });

  // Intercept Socket.IO CDN so the real library doesn't overwrite our mock
  await page.route(/socket\.io.*\.js/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: '/* socket.io mock: real lib intercepted */',
    });
  });

  // Mock health check endpoint so connectionManager proceeds
  await page.route('**/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{"status":"ok","uptime":100}',
    });
  });
}

async function waitForSocket(page: Page) {
  // Deterministic readiness signal: the app has called the mocked io() and
  // registered its socket. Replaces fixed post-goto sleeps (web-first waiting).
  await page.waitForFunction(() => {
    const sockets = (window as any).__mockSockets;
    return Array.isArray(sockets) && sockets.length > 0;
  });
}

async function driveConnect(page: Page) {
  // Drive the real connect path: the navbar connect modal dispatches this event,
  // after which the app opens the (mocked) socket. Then wait for that socket to
  // exist instead of sleeping — so the event handlers below run for real.
  await page.evaluate(() => {
    document.dispatchEvent(
      new CustomEvent('navbar:connect', {
        detail: { service: 'qvc-server', url: 'http://localhost:9999' },
      }),
    );
  });
  await waitForSocket(page);
}

async function fireMockEvent(page: Page, event: string, ...args: unknown[]) {
  await page.evaluate(
    ({ event, args }) => {
      const sock =
        (window as any).connectionSocket ||
        ((window as any).__mockSockets && (window as any).__mockSockets[0]);
      if (sock && sock._fire) sock._fire(event, ...args);
    },
    { event, args },
  );
}

async function getEmitted(page: Page) {
  return page.evaluate(() => {
    const sock =
      (window as any).connectionSocket ||
      ((window as any).__mockSockets && (window as any).__mockSockets[0]);
    return sock ? sock._emitted : [];
  });
}

// ── App shell tests ─────────────────────────────────────────────────────────

test.describe('QVC Client — app shell', () => {
  test('loads without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/projects/quantum-video-chat/client/');
    await expect(page.locator('#app')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('renders the app div', async ({ page }) => {
    await page.goto('/projects/quantum-video-chat/client/');
    await expect(page.locator('#app')).toBeVisible();
    // Window chrome should be present
    await expect(page.locator('.title-bar')).toBeVisible();
  });

  test('has correct page title', async ({ page }) => {
    await page.goto('/projects/quantum-video-chat/client/');
    await expect(page).toHaveTitle(/Video Chat/);
  });

  test('loads Socket.IO and connection scripts', async ({ page }) => {
    const scriptSrcs: string[] = [];
    page.on('request', (req) => {
      if (req.resourceType() === 'script') {
        scriptSrcs.push(req.url());
      }
    });
    await page.goto('/projects/quantum-video-chat/client/');
    expect(scriptSrcs.some((s) => s.includes('socket.io'))).toBe(true);
    expect(scriptSrcs.some((s) => s.includes('server-connect-modal.js'))).toBe(true);
    expect(scriptSrcs.some((s) => s.includes('app.js'))).toBe(true);
  });
});

// ── Connection flow with mocked Socket.IO ───────────────────────────────────

test.describe('QVC Client — mocked connection flow', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
  });

  test('io() mock is installed on the page', async ({ page }) => {
    await page.goto('/projects/quantum-video-chat/client/');
    // The init script installs the mock before any page script and the CDN is
    // intercepted, so the real lib never overwrites it. Poll instead of sleeping.
    await expect
      .poll(() =>
        page.evaluate(
          () => typeof (window as any).io === 'function' && !!(window as any).__mockSockets,
        ),
      )
      .toBe(true);
  });

  test('app shell survives when socket events fire', async ({ page }) => {
    await page.goto('/projects/quantum-video-chat/client/');
    await driveConnect(page);

    // fireMockEvent runs the handlers synchronously inside page.evaluate, so the
    // auto-waiting toBeVisible() assertion below is a sufficient post-condition.
    await fireMockEvent(page, 'welcome', { client_id: 'test-client', heartbeat_interval: 25 });
    await fireMockEvent(page, 'server-connected');
    await fireMockEvent(page, 'user-registered', { userId: 'test-user-1' });

    await expect(page.locator('#app')).toBeVisible();
  });

  test('app handles room-id event without crashing', async ({ page }) => {
    await page.goto('/projects/quantum-video-chat/client/');
    await driveConnect(page);

    await fireMockEvent(page, 'welcome', { client_id: 'test-client', heartbeat_interval: 25 });
    await fireMockEvent(page, 'server-connected');
    await fireMockEvent(page, 'user-registered', { userId: 'test-user-1' });
    await fireMockEvent(page, 'room-id', { room: 'test-room-42' });

    await expect(page.locator('#app')).toBeVisible();
  });

  test('app handles server-error without crashing', async ({ page }) => {
    await page.goto('/projects/quantum-video-chat/client/');
    await driveConnect(page);

    await fireMockEvent(page, 'server-error', { message: 'Connection refused' });

    await expect(page.locator('#app')).toBeVisible();
  });

  test('app handles peer-disconnected without crashing', async ({ page }) => {
    await page.goto('/projects/quantum-video-chat/client/');
    await driveConnect(page);

    await fireMockEvent(page, 'welcome', { client_id: 'test-client', heartbeat_interval: 25 });
    await fireMockEvent(page, 'server-connected');
    await fireMockEvent(page, 'user-registered', { userId: 'test-user-1' });
    await fireMockEvent(page, 'room-id', { room: 'test-room-42' });
    await fireMockEvent(page, 'peer-disconnected');

    await expect(page.locator('#app')).toBeVisible();
  });

  test('app handles QBER update without crashing', async ({ page }) => {
    await page.goto('/projects/quantum-video-chat/client/');
    await driveConnect(page);

    await fireMockEvent(page, 'welcome', { client_id: 'test-client', heartbeat_interval: 25 });
    await fireMockEvent(page, 'server-connected');
    await fireMockEvent(page, 'user-registered', { userId: 'test-user-1' });
    await fireMockEvent(page, 'room-id', { room: 'test-room-42' });

    await fireMockEvent(page, 'qber-update', {
      qber: 0.05,
      key_length: 256,
      event_type: 'key_rotation',
      keys_exchanged: 10,
      eavesdropper_detected: false,
    });

    await expect(page.locator('#app')).toBeVisible();
  });

  test('app handles eavesdropper detection without crashing', async ({ page }) => {
    await page.goto('/projects/quantum-video-chat/client/');
    await driveConnect(page);

    await fireMockEvent(page, 'welcome', { client_id: 'test-client', heartbeat_interval: 25 });
    await fireMockEvent(page, 'server-connected');
    await fireMockEvent(page, 'user-registered', { userId: 'test-user-1' });
    await fireMockEvent(page, 'room-id', { room: 'test-room-42' });

    await fireMockEvent(page, 'qber-update', {
      qber: 0.35,
      key_length: 128,
      event_type: 'eavesdropper_detected',
      keys_exchanged: 3,
      eavesdropper_detected: true,
    });

    await expect(page.locator('#app')).toBeVisible();
  });

  test('app handles video frame without crashing', async ({ page }) => {
    await page.goto('/projects/quantum-video-chat/client/');
    await driveConnect(page);

    await fireMockEvent(page, 'welcome', { client_id: 'test-client', heartbeat_interval: 25 });
    await fireMockEvent(page, 'server-connected');
    await fireMockEvent(page, 'user-registered', { userId: 'test-user-1' });
    await fireMockEvent(page, 'room-id', { room: 'test-room-42' });

    // Small fake frame (2x2 BGR)
    await fireMockEvent(page, 'frame', {
      sender: 'peer-user',
      frame: [
        [
          [0, 0, 255],
          [0, 255, 0],
        ],
        [
          [255, 0, 0],
          [255, 255, 255],
        ],
      ],
    });

    await expect(page.locator('#app')).toBeVisible();
  });
});
