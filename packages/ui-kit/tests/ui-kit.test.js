/**
 * @jest-environment jsdom
 */
const fs = require('fs');
const path = require('path');

function loadUIKit() {
  delete window.UIKit;
  localStorage.clear();
  eval(fs.readFileSync(path.resolve(__dirname, '..', 'ui-kit.js'), 'utf-8'));
  return window.UIKit;
}

let UIKit;
beforeEach(() => {
  document.body.innerHTML = '';
  UIKit = loadUIKit();
});

describe('UIKit.initThemeToggle', () => {
  test('toggles data-theme on click', () => {
    document.documentElement.dataset.theme = 'dark';
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    UIKit.initThemeToggle(btn);

    btn.click();
    expect(document.documentElement.dataset.theme).toBe('light');
    btn.click();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});

describe('UIKit.initDrawer', () => {
  test('toggles .open class', () => {
    const drawer = document.createElement('div');
    const handle = document.createElement('button');
    document.body.append(drawer, handle);

    const api = UIKit.initDrawer(drawer, handle);
    handle.click();
    expect(drawer.classList.contains('open')).toBe(true);
    handle.click();
    expect(drawer.classList.contains('open')).toBe(false);
  });
});

describe('UIKit.initDropdown', () => {
  test('toggles .hidden class', () => {
    const trigger = document.createElement('button');
    const menu = document.createElement('div');
    menu.classList.add('hidden');
    document.body.append(trigger, menu);

    UIKit.initDropdown(trigger, menu);
    trigger.click();
    expect(menu.classList.contains('hidden')).toBe(false);
    trigger.click();
    expect(menu.classList.contains('hidden')).toBe(true);
  });
});

describe('UIKit.onEscape', () => {
  test('fires callback on Escape key', () => {
    const cb = jest.fn();
    UIKit.onEscape(cb);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  test('does not fire on other keys', () => {
    const cb = jest.fn();
    UIKit.onEscape(cb);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('UIKit.createLogger', () => {
  test('appends log entries', () => {
    const terminal = document.createElement('div');
    document.body.appendChild(terminal);
    const log = UIKit.createLogger(terminal, 5);

    log('hello');
    log('world');
    expect(terminal.children.length).toBe(2);
    expect(terminal.querySelector('.log-msg').textContent).toBe('hello');
  });

  test('respects max entries', () => {
    const terminal = document.createElement('div');
    document.body.appendChild(terminal);
    const log = UIKit.createLogger(terminal, 3);

    for (let i = 0; i < 5; i++) log(`msg ${i}`);
    expect(terminal.children.length).toBe(3);
  });
});

describe('UIKit.toast', () => {
  test('creates toast element', () => {
    const toast = UIKit.toast('Test message', { duration: 0 });
    expect(toast).not.toBeNull();
    expect(toast.textContent).toBe('Test message');
    expect(document.querySelector('.ui-toast-container')).not.toBeNull();
  });
});
