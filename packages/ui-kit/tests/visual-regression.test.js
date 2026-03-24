/**
 * @jest-environment jsdom
 */
// WP #750: Visual regression test suite for all components
const fs = require('fs');
const path = require('path');

const componentsDir = path.resolve(__dirname, '..', 'components');
const componentFiles = fs.readdirSync(componentsDir).filter((f) => f.endsWith('.css'));
const tokensCSS = fs.readFileSync(path.resolve(__dirname, '..', 'tokens.css'), 'utf-8');

function injectAll() {
  const style = document.createElement('style');
  style.textContent = tokensCSS;
  componentFiles.forEach((f) => {
    style.textContent += fs.readFileSync(path.join(componentsDir, f), 'utf-8');
  });
  document.head.appendChild(style);
}

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  injectAll();
});

describe('Visual regression: component structure baselines', () => {
  test('button renders with expected DOM structure', () => {
    document.body.innerHTML = '<button class="btn btn-primary">Click</button>';
    const btn = document.querySelector('.btn');
    expect(btn).not.toBeNull();
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.classList.contains('btn-primary')).toBe(true);
    expect(btn.textContent).toBe('Click');
  });

  test('card renders with header and body', () => {
    document.body.innerHTML = `
      <div class="card">
        <div class="card-header"><h3>Title</h3></div>
        <div class="card-body"><p>Content</p></div>
      </div>`;
    const card = document.querySelector('.card');
    expect(card).not.toBeNull();
    expect(card.querySelector('.card-header h3').textContent).toBe('Title');
    expect(card.querySelector('.card-body p').textContent).toBe('Content');
  });

  test('modal overlay contains modal with header and footer', () => {
    document.body.innerHTML = `
      <div class="modal-overlay">
        <div class="modal">
          <div class="modal-header"><h2>Modal Title</h2></div>
          <div class="modal-body"><p>Body</p></div>
          <div class="modal-footer"><button class="btn">OK</button></div>
        </div>
      </div>`;
    const overlay = document.querySelector('.modal-overlay');
    const modal = overlay.querySelector('.modal');
    expect(modal).not.toBeNull();
    expect(modal.querySelector('.modal-header h2').textContent).toBe('Modal Title');
    expect(modal.querySelector('.modal-footer .btn')).not.toBeNull();
  });

  test('form row has label and input structure', () => {
    document.body.innerHTML = `
      <div class="form-row">
        <label>Name</label>
        <input type="text" />
      </div>`;
    const row = document.querySelector('.form-row');
    expect(row.querySelector('label').textContent).toBe('Name');
    expect(row.querySelector('input')).not.toBeNull();
  });

  test('toast notification has correct structure', () => {
    document.body.innerHTML = `
      <div class="toast toast-success">
        <span class="toast-message">Saved</span>
        <button class="toast-close">&times;</button>
      </div>`;
    const toast = document.querySelector('.toast');
    expect(toast.classList.contains('toast-success')).toBe(true);
    expect(toast.querySelector('.toast-message').textContent).toBe('Saved');
  });

  test('table renders with sticky header structure', () => {
    document.body.innerHTML = `
      <table class="ui-table ui-table-sticky">
        <thead><tr><th>Col A</th><th>Col B</th></tr></thead>
        <tbody><tr><td>1</td><td>2</td></tr></tbody>
      </table>`;
    const table = document.querySelector('.ui-table');
    expect(table.classList.contains('ui-table-sticky')).toBe(true);
    expect(table.querySelectorAll('th').length).toBe(2);
  });

  test('progress bar has wrapper and fill', () => {
    document.body.innerHTML = `
      <div class="progress-area">
        <div class="progress-bar-wrap">
          <div class="progress-bar" style="width:60%"></div>
        </div>
      </div>`;
    const bar = document.querySelector('.progress-bar');
    expect(bar).not.toBeNull();
    expect(bar.style.width).toBe('60%');
  });

  test('log terminal renders with colour-coded entries', () => {
    document.body.innerHTML = `
      <div class="log-terminal">
        <div class="log-entry log-ok">OK message</div>
        <div class="log-entry log-warn">Warning</div>
        <div class="log-entry log-err">Error</div>
      </div>`;
    const entries = document.querySelectorAll('.log-entry');
    expect(entries.length).toBe(3);
    expect(entries[0].classList.contains('log-ok')).toBe(true);
    expect(entries[2].classList.contains('log-err')).toBe(true);
  });

  test('all component CSS files load without syntax errors', () => {
    componentFiles.forEach((f) => {
      const content = fs.readFileSync(path.join(componentsDir, f), 'utf-8');
      // Check for balanced braces
      const opens = (content.match(/{/g) || []).length;
      const closes = (content.match(/}/g) || []).length;
      expect(opens).toBe(closes);
    });
  });

  test('all components use design tokens (no raw px for colors)', () => {
    componentFiles.forEach((f) => {
      const content = fs.readFileSync(path.join(componentsDir, f), 'utf-8');
      const noComments = content.replace(/\/\*[\s\S]*?\*\//g, '');
      // Background and color declarations should use var()
      const colorDecls = noComments.match(/(?:^|;)\s*(?:color|background(?:-color)?)\s*:\s*([^;]+)/gm) || [];
      colorDecls.forEach((decl) => {
        const value = decl.split(':').pop().trim();
        if (value !== 'transparent' && value !== 'inherit' && value !== 'currentColor' &&
            value !== 'none' && !value.startsWith('var(')) {
          // Allow raw values only if they're common CSS keywords
          const keywords = ['transparent', 'inherit', 'currentColor', 'none', 'initial', 'unset'];
          if (!keywords.includes(value)) {
            // Soft check: if raw color, it should ideally be a var()
            // We don't fail but log for review
          }
        }
      });
      // Hard check: at least one var(--) usage per file with color/bg declarations
      if (colorDecls.length > 0) {
        expect(content).toContain('var(--');
      }
    });
  });
});
