/**
 * @jest-environment jsdom
 */
// WP #757: Test: Navigation bar component
const fs = require('fs');
const path = require('path');

const CSS = fs.readFileSync(path.resolve(__dirname, '..', 'components', 'navbar.css'), 'utf-8');

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
});

describe('Navigation bar component', () => {
  test('navbar renders with links', () => {
    const nav = document.createElement('nav');
    nav.className = 'ui-navbar';
    nav.innerHTML = `
      <div class="ui-navbar-left"><a class="ui-navbar-brand" href="#">Brand</a></div>
      <div class="ui-navbar-right">
        <a class="ui-navbar-link active" href="#">Home</a>
        <a class="ui-navbar-link" href="#">About</a>
      </div>
    `;
    document.body.appendChild(nav);

    expect(nav.querySelector('.ui-navbar-brand').textContent).toBe('Brand');
    expect(nav.querySelectorAll('.ui-navbar-link').length).toBe(2);
    expect(nav.querySelector('.ui-navbar-link.active')).not.toBeNull();
  });

  test('navbar uses CSS custom properties', () => {
    expect(CSS).toContain('var(--');
  });

  test('navbar has transition on links', () => {
    expect(CSS).toContain('transition');
  });

  test('navbar link hover styles exist', () => {
    expect(CSS).toMatch(/navbar.*:hover/);
  });

  test('navbar uses border for structure', () => {
    expect(CSS).toContain('border');
  });

  test('active link state is styled', () => {
    expect(CSS).toContain('.active');
  });
});
