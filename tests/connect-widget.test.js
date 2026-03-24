/**
 * @jest-environment jsdom
 */
const fs = require('fs');
const path = require('path');

function loadUIKit() {
  delete window.UIKit;
  delete window.ServiceConfig;
  localStorage.clear();

  // Load service-config first
  eval(fs.readFileSync(path.resolve(__dirname, '..', 'service-config.js'), 'utf-8'));
  // Load ui-kit
  eval(fs.readFileSync(path.resolve(__dirname, '..', 'ui-kit.js'), 'utf-8'));
  return window.UIKit;
}

let UIKit;
beforeEach(() => {
  document.body.innerHTML = '<div id="connect-test"></div>';
  UIKit = loadUIKit();
});

describe('UIKit.initConnect', () => {
  test('renders host input, port input, button, and status dot', () => {
    const el = document.getElementById('connect-test');
    UIKit.initConnect(el, { defaultHost: 'localhost', defaultPort: 5055 });

    expect(el.querySelector('.ui-connect-host')).not.toBeNull();
    expect(el.querySelector('.ui-connect-port')).not.toBeNull();
    expect(el.querySelector('.ui-connect-btn')).not.toBeNull();
    expect(el.querySelector('.ui-connect-dot')).not.toBeNull();
    expect(el.querySelector('.ui-connect-state')).not.toBeNull();
  });

  test('populates default host and port', () => {
    const el = document.getElementById('connect-test');
    UIKit.initConnect(el, { defaultHost: 'myhost', defaultPort: 9999 });

    expect(el.querySelector('.ui-connect-host').value).toBe('myhost');
    expect(el.querySelector('.ui-connect-port').value).toBe('9999');
  });

  test('setStatus("connected") updates dot and button', () => {
    const el = document.getElementById('connect-test');
    const widget = UIKit.initConnect(el, {});

    widget.setStatus('connected');
    expect(el.querySelector('.ui-connect-dot').dataset.state).toBe('connected');
    expect(el.querySelector('.ui-connect-btn').textContent).toBe('Connected');
    expect(el.querySelector('.ui-connect-btn').classList.contains('connected')).toBe(true);
  });

  test('setStatus("disconnected") resets button', () => {
    const el = document.getElementById('connect-test');
    const widget = UIKit.initConnect(el, {});

    widget.setStatus('connected');
    widget.setStatus('disconnected');
    expect(el.querySelector('.ui-connect-dot').dataset.state).toBe('disconnected');
    expect(el.querySelector('.ui-connect-btn').textContent).toBe('Connect');
    expect(el.querySelector('.ui-connect-btn').classList.contains('connected')).toBe(false);
  });

  test('setStatus with custom message', () => {
    const el = document.getElementById('connect-test');
    const widget = UIKit.initConnect(el, {});

    widget.setStatus('error', 'Connection refused');
    expect(el.querySelector('.ui-connect-state').textContent).toBe('Connection refused');
  });

  test('onConnect callback fires with correct data', () => {
    const el = document.getElementById('connect-test');
    const onConnect = jest.fn();
    UIKit.initConnect(el, { defaultHost: 'localhost', defaultPort: 5055, onConnect });

    el.querySelector('.ui-connect-btn').click();
    expect(onConnect).toHaveBeenCalledWith({
      host: 'localhost',
      port: 5055,
      url: 'https://localhost:5055'
    });
  });

  test('getUrl() builds correct URL', () => {
    const el = document.getElementById('connect-test');
    const widget = UIKit.initConnect(el, { defaultHost: 'myhost', defaultPort: 8080 });

    expect(widget.getUrl()).toBe('https://myhost:8080');
  });

  test('destroy() removes click listener', () => {
    const el = document.getElementById('connect-test');
    const onConnect = jest.fn();
    const widget = UIKit.initConnect(el, { onConnect });

    widget.destroy();
    el.querySelector('.ui-connect-btn').click();
    expect(onConnect).not.toHaveBeenCalled();
  });
});
