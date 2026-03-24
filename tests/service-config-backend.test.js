/**
 * @jest-environment jsdom
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

  const code = fs.readFileSync(path.resolve(__dirname, '..', 'service-config.js'), 'utf-8');
  eval(code);
  return window.ServiceConfig;
}

beforeEach(() => {
  localStorage.clear();
  delete window.ServiceConfig;
});

describe('ServiceConfig.resolveBackend', () => {
  test('returns default when nothing configured', () => {
    const sc = loadServiceConfig();
    expect(sc.resolveBackend('test', 'http://localhost:5000')).toBe('http://localhost:5000');
  });

  test('returns ?backend= param when present', () => {
    const sc = loadServiceConfig('backend=192.168.1.10:5055');
    expect(sc.resolveBackend('test', 'http://localhost:5000')).toBe('https://192.168.1.10:5055');
  });

  test('?serviceName= takes priority over ?backend=', () => {
    const sc = loadServiceConfig('test=specific:1111&backend=generic:2222');
    expect(sc.resolveBackend('test', 'http://default:3333')).toBe('https://specific:1111');
  });

  test('?backend= takes priority over localStorage', () => {
    const sc = loadServiceConfig('backend=param:4444', { test: 'http://stored:5555' });
    expect(sc.resolveBackend('test', 'http://default:6666')).toBe('https://param:4444');
  });

  test('falls through to localStorage when no URL params', () => {
    // Pass a dummy param to reset location (null/empty preserves previous test's params)
    const sc = loadServiceConfig('_nocache=1', { test: 'http://stored:7777' });
    expect(sc.resolveBackend('test', 'http://default:8888')).toBe('http://stored:7777');
  });

  test('normalises ?backend= value (adds protocol, strips slash)', () => {
    const sc = loadServiceConfig('backend=myhost:9090/');
    expect(sc.resolveBackend('svc', 'http://x:1')).toBe('https://myhost:9090');
  });

  test('full URL in ?backend= is preserved', () => {
    const sc = loadServiceConfig('backend=http://myhost:9090');
    expect(sc.resolveBackend('svc', 'https://x:1')).toBe('http://myhost:9090');
  });

  test('existing get() method is unaffected', () => {
    const sc = loadServiceConfig('backend=generic:2222');
    // get() should NOT pick up ?backend= — only resolveBackend does
    expect(sc.get('test', 'http://default:3333')).toBe('http://default:3333');
  });
});
