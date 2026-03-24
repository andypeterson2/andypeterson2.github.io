/**
 * @jest-environment jsdom
 */
const fs = require('fs');
const path = require('path');

// Load service-config.js into jsdom
function loadServiceConfig(searchParams, preStorage) {
  // Reset
  delete window.ServiceConfig;
  localStorage.clear();

  // Pre-populate localStorage before eval so _stored picks it up
  if (preStorage) {
    localStorage.setItem('service-config', JSON.stringify(preStorage));
  }

  // Mock URL search params
  if (searchParams) {
    delete window.location;
    window.location = new URL('http://localhost?' + searchParams);
  }

  const code = fs.readFileSync(path.resolve(__dirname, '..', 'service-config.js'), 'utf-8');
  eval(code);
  return window.ServiceConfig;
}

beforeEach(() => {
  localStorage.clear();
  delete window.ServiceConfig;
});

describe('ServiceConfig', () => {
  test('get() returns default when nothing stored', () => {
    const sc = loadServiceConfig();
    expect(sc.get('test', 'http://localhost:5000')).toBe('http://localhost:5000');
  });

  test('get() returns localStorage value when stored', () => {
    const sc = loadServiceConfig(null, { test: 'http://myhost:9999' });
    expect(sc.get('test', 'http://localhost:5000')).toBe('http://myhost:9999');
  });

  test('get() returns URL param value when present', () => {
    const sc = loadServiceConfig('test=192.168.1.10:5055');
    expect(sc.get('test', 'http://localhost:5000')).toBe('https://192.168.1.10:5055');
  });

  test('URL params take priority over localStorage', () => {
    const sc = loadServiceConfig('test=param:2222', { test: 'http://stored:1111' });
    expect(sc.get('test', 'http://default:3333')).toBe('https://param:2222');
  });

  test('set() persists to localStorage', () => {
    const sc = loadServiceConfig();
    sc.set('myservice', 'http://host:4000');
    const stored = JSON.parse(localStorage.getItem('service-config'));
    expect(stored.myservice).toBe('http://host:4000');
  });

  test('remove() clears stored value', () => {
    const sc = loadServiceConfig();
    sc.set('myservice', 'http://host:4000');
    sc.remove('myservice');
    const stored = JSON.parse(localStorage.getItem('service-config'));
    expect(stored.myservice).toBeUndefined();
  });

  test('normalises URLs: adds https://, strips trailing slash', () => {
    const sc = loadServiceConfig();
    expect(sc.get('x', 'localhost:3000/')).toBe('https://localhost:3000');
    expect(sc.get('x', 'http://host:80/')).toBe('http://host:80');
  });

  test('isConfigured() returns false when not set', () => {
    const sc = loadServiceConfig();
    expect(sc.isConfigured('nope')).toBe(false);
  });

  test('isConfigured() returns true when stored', () => {
    const sc = loadServiceConfig();
    sc.set('yes', 'http://x:1');
    expect(sc.isConfigured('yes')).toBe(true);
  });
});
