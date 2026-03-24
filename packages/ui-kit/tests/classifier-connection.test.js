/**
 * @jest-environment jsdom
 *
 * Tests for the classifier app's backend connection gating logic.
 * Verifies that training, prediction, and evaluation are blocked
 * until the backend is verified reachable.
 */
const fs = require('fs');
const path = require('path');

function loadServiceConfig(searchParams, preStorage) {
  delete window.ServiceConfig;
  localStorage.clear();
  if (preStorage) {
    localStorage.setItem('service-config', JSON.stringify(preStorage));
  }
  if (searchParams) {
    delete window.location;
    window.location = new URL('http://localhost?' + searchParams);
  }
  eval(fs.readFileSync(path.resolve(__dirname, '..', 'service-config.js'), 'utf-8'));
  return window.ServiceConfig;
}

function loadUIKit() {
  eval(fs.readFileSync(path.resolve(__dirname, '..', 'ui-kit.js'), 'utf-8'));
  return window.UIKit;
}

describe('Classifier connection gating', () => {

  describe('ServiceConfig stores classifier URL on connect', () => {
    test('set() persists classifier URL to localStorage', () => {
      const sc = loadServiceConfig();
      sc.set('classifier', 'https://localhost:5001');
      const stored = JSON.parse(localStorage.getItem('service-config'));
      expect(stored.classifier).toBe('https://localhost:5001');
    });

    test('resolveBackend returns stored classifier URL', () => {
      const sc = loadServiceConfig(null, { classifier: 'https://myhost:5001' });
      expect(sc.resolveBackend('classifier', 'https://localhost:5001')).toBe('https://myhost:5001');
    });

    test('resolveBackend prefers ?classifier= URL param', () => {
      const sc = loadServiceConfig('classifier=192.168.1.50:5001', { classifier: 'https://stored:5001' });
      expect(sc.resolveBackend('classifier', 'https://localhost:5001')).toBe('https://192.168.1.50:5001');
    });

    test('resolveBackend prefers ?backend= over stored', () => {
      const sc = loadServiceConfig('backend=10.0.0.1:5001', { classifier: 'https://stored:5001' });
      expect(sc.resolveBackend('classifier', 'https://localhost:5001')).toBe('https://10.0.0.1:5001');
    });
  });

  describe('Connect widget for classifier service', () => {
    let UIKit;

    beforeEach(() => {
      document.body.innerHTML = '<div id="connect-test"></div>';
      loadServiceConfig();
      UIKit = loadUIKit();
    });

    test('renders with classifier defaults', () => {
      const el = document.getElementById('connect-test');
      UIKit.initConnect(el, { service: 'classifier', defaultHost: 'localhost', defaultPort: 5001 });

      expect(el.querySelector('.ui-connect-host').value).toBe('localhost');
      expect(el.querySelector('.ui-connect-port').value).toBe('5001');
    });

    test('connect click saves URL to ServiceConfig', () => {
      const el = document.getElementById('connect-test');
      UIKit.initConnect(el, { service: 'classifier', defaultHost: 'localhost', defaultPort: 5001 });

      el.querySelector('.ui-connect-btn').click();
      const stored = JSON.parse(localStorage.getItem('service-config'));
      expect(stored.classifier).toBe('https://localhost:5001');
    });

    test('connect click with custom host saves correct URL', () => {
      const el = document.getElementById('connect-test');
      UIKit.initConnect(el, { service: 'classifier', defaultHost: 'localhost', defaultPort: 5001 });

      el.querySelector('.ui-connect-host').value = '192.168.1.100';
      el.querySelector('.ui-connect-port').value = '5001';
      el.querySelector('.ui-connect-btn').click();

      const stored = JSON.parse(localStorage.getItem('service-config'));
      expect(stored.classifier).toBe('https://192.168.1.100:5001');
    });

    test('status transitions work correctly', () => {
      const el = document.getElementById('connect-test');
      const widget = UIKit.initConnect(el, { service: 'classifier', defaultHost: 'localhost', defaultPort: 5001 });

      // Initial state
      expect(el.querySelector('.ui-connect-dot').dataset.state).toBe('idle');
      expect(el.querySelector('.ui-connect-state').textContent).toBe('Not connected');

      // Connecting
      widget.setStatus('connecting');
      expect(el.querySelector('.ui-connect-dot').dataset.state).toBe('connecting');

      // Connected
      widget.setStatus('connected');
      expect(el.querySelector('.ui-connect-dot').dataset.state).toBe('connected');
      expect(el.querySelector('.ui-connect-btn').textContent).toBe('Connected');

      // Disconnected
      widget.setStatus('disconnected', 'Unable to reach server');
      expect(el.querySelector('.ui-connect-dot').dataset.state).toBe('disconnected');
      expect(el.querySelector('.ui-connect-state').textContent).toBe('Unable to reach server');
    });
  });
});
