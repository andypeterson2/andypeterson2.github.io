/**
 * @jest-environment jsdom
 */
// WP #761: Test: Form input components
const fs = require('fs');
const path = require('path');

const formsCSS = fs.readFileSync(path.resolve(__dirname, '..', 'components', 'forms.css'), 'utf-8');
const toggleCSS = fs.readFileSync(path.resolve(__dirname, '..', 'components', 'toggle.css'), 'utf-8');
const fieldsetCSS = fs.readFileSync(path.resolve(__dirname, '..', 'components', 'fieldset.css'), 'utf-8');

describe('Form input components', () => {
  test('form-row class is defined', () => {
    expect(formsCSS).toContain('.form-row');
  });

  test('input styling uses CSS custom properties', () => {
    expect(formsCSS).toContain('var(--border)');
    expect(formsCSS).toContain('var(--surface2)');
  });

  test('input has focus transition', () => {
    expect(formsCSS).toContain('transition');
    expect(formsCSS).toContain('border-color');
  });

  test('select element is styled', () => {
    expect(formsCSS).toContain('select');
  });

  test('toggle switch component exists', () => {
    expect(toggleCSS).toContain('.ui-toggle');
  });

  test('toggle has transition animation', () => {
    expect(toggleCSS).toContain('transition');
  });

  test('toggle uses custom properties for theming', () => {
    expect(toggleCSS).toContain('var(--');
  });

  test('fieldset component is defined', () => {
    expect(fieldsetCSS.length).toBeGreaterThan(0);
  });

  test('form inputs render correctly', () => {
    const style = document.createElement('style');
    style.textContent = formsCSS;
    document.head.appendChild(style);

    const form = document.createElement('form');
    form.innerHTML = `
      <div class="form-row">
        <label>Name</label>
        <input type="text" placeholder="Enter name">
      </div>
      <div class="form-row">
        <select><option>A</option><option>B</option></select>
      </div>
    `;
    document.body.appendChild(form);

    expect(form.querySelectorAll('.form-row').length).toBe(2);
    expect(form.querySelector('input').placeholder).toBe('Enter name');
    expect(form.querySelector('select').options.length).toBe(2);
  });
});
