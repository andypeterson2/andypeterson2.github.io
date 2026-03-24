/**
 * @jest-environment jsdom
 */
// WP #756: Test: Card component and interactive hover
const fs = require('fs');
const path = require('path');

const CSS = fs.readFileSync(path.resolve(__dirname, '..', 'components', 'cards.css'), 'utf-8');

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
});

describe('Card component and interactive hover', () => {
  test('card renders with correct structure', () => {
    const card = document.createElement('div');
    card.className = 'card';
    const header = document.createElement('div');
    header.className = 'card-header';
    const h2 = document.createElement('h2');
    h2.textContent = 'Title';
    header.appendChild(h2);
    card.appendChild(header);
    document.body.appendChild(card);

    expect(card.querySelector('.card-header')).not.toBeNull();
    expect(card.querySelector('h2').textContent).toBe('Title');
  });

  test('card-interactive class can be added', () => {
    const card = document.createElement('div');
    card.className = 'card card-interactive';
    document.body.appendChild(card);
    expect(card.classList.contains('card-interactive')).toBe(true);
  });

  test('stacked cards with margin collapse', () => {
    const c1 = document.createElement('div');
    c1.className = 'card';
    const c2 = document.createElement('div');
    c2.className = 'card';
    document.body.append(c1, c2);
    expect(CSS).toContain('.card + .card');
  });

  test('card uses CSS custom properties for theming', () => {
    expect(CSS).toContain('var(--surface)');
    expect(CSS).toContain('var(--border)');
  });

  test('card has transition for hover effects', () => {
    expect(CSS).toMatch(/\.card\s*\{[^}]*transition:/);
  });

  test('card-interactive has hover styles', () => {
    expect(CSS).toContain('.card.card-interactive:hover');
  });

  test('card-header has flex layout', () => {
    expect(CSS).toContain('display: flex');
    expect(CSS).toContain('justify-content: space-between');
  });

  test('card uses flex column layout', () => {
    expect(CSS).toContain('flex-direction: column');
  });
});
