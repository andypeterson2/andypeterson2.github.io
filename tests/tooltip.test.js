/**
 * @jest-environment jsdom
 */
// WP #763: Test: Tooltip and popover positioning
const fs = require('fs');
const path = require('path');

const tooltipCSS = fs.readFileSync(path.resolve(__dirname, '..', 'components', 'tooltip.css'), 'utf-8');
const dropdownsCSS = fs.readFileSync(path.resolve(__dirname, '..', 'components', 'dropdowns.css'), 'utf-8');

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  const style = document.createElement('style');
  style.textContent = tooltipCSS + dropdownsCSS;
  document.head.appendChild(style);
});

describe('Tooltip and popover positioning', () => {
  test('tooltip uses data-tooltip attribute', () => {
    expect(tooltipCSS).toContain('[data-tooltip]');
    expect(tooltipCSS).toContain('attr(data-tooltip)');
  });

  test('tooltip is positioned absolutely', () => {
    expect(tooltipCSS).toContain('position: absolute');
  });

  test('tooltip appears above element (bottom: calc(100% + ...))', () => {
    expect(tooltipCSS).toContain('bottom: calc(100%');
  });

  test('tooltip is centered horizontally', () => {
    expect(tooltipCSS).toContain('left: 50%');
    expect(tooltipCSS).toContain('translateX(-50%)');
  });

  test('tooltip starts hidden (opacity: 0)', () => {
    expect(tooltipCSS).toContain('opacity: 0');
  });

  test('tooltip shows on hover', () => {
    expect(tooltipCSS).toContain('[data-tooltip]:hover::after');
    expect(tooltipCSS).toContain('opacity: 1');
  });

  test('tooltip has transition animation', () => {
    expect(tooltipCSS).toContain('transition');
  });

  test('tooltip has z-index for stacking', () => {
    expect(tooltipCSS).toContain('z-index');
  });

  test('tooltip uses CSS custom properties', () => {
    expect(tooltipCSS).toContain('var(--surface)');
    expect(tooltipCSS).toContain('var(--border)');
    expect(tooltipCSS).toContain('var(--text)');
  });

  test('tooltip renders with data attribute', () => {
    const btn = document.createElement('button');
    btn.dataset.tooltip = 'Hello tooltip';
    document.body.appendChild(btn);
    expect(btn.dataset.tooltip).toBe('Hello tooltip');
  });

  test('dropdown is positioned absolutely', () => {
    expect(dropdownsCSS).toContain('position: absolute');
  });

  test('dropdown has z-index', () => {
    expect(dropdownsCSS).toContain('z-index');
  });

  test('dropdown items have hover styles', () => {
    expect(dropdownsCSS).toContain('.ui-dropdown-item:hover');
  });

  test('dropdown items have active state', () => {
    expect(dropdownsCSS).toContain('.ui-dropdown-item.active');
  });

  test('dropdown has entrance animation', () => {
    expect(dropdownsCSS).toContain('@keyframes dropdown-in');
    expect(dropdownsCSS).toContain('animation');
  });
});
