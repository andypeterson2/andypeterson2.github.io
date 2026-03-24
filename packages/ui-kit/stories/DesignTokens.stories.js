/** @type {import('@storybook/html').Meta} */
export default {
  title: 'Foundation/Design Tokens',
};

function swatch(label, varName) {
  const el = document.createElement('div');
  el.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:6px';
  const box = document.createElement('div');
  box.style.cssText = `width:32px;height:32px;border:1px solid var(--border);background:var(${varName})`;
  const text = document.createElement('span');
  text.style.cssText = 'font-size:12px;color:var(--text-secondary);font-family:var(--font-mono)';
  text.textContent = `${label}  ${varName}`;
  el.appendChild(box);
  el.appendChild(text);
  return el;
}

export const Surfaces = {
  render: () => {
    const wrap = document.createElement('div');
    [['bg', '--bg'], ['surface', '--surface'], ['surface2', '--surface2'], ['muted', '--surface-muted'], ['highlight', '--surface-hl']].forEach(([l, v]) => wrap.appendChild(swatch(l, v)));
    return wrap;
  },
};

export const Accents = {
  render: () => {
    const wrap = document.createElement('div');
    [['accent', '--accent'], ['hover', '--accent-hover'], ['teal', '--accent-teal'], ['olive', '--accent-olive'], ['brown', '--accent-brown'], ['dark', '--accent-dark']].forEach(([l, v]) => wrap.appendChild(swatch(l, v)));
    return wrap;
  },
};

export const Semantic = {
  render: () => {
    const wrap = document.createElement('div');
    [['success', '--success'], ['warn', '--warn'], ['danger', '--danger']].forEach(([l, v]) => wrap.appendChild(swatch(l, v)));
    return wrap;
  },
};

export const Typography = {
  render: () => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:8px';
    [['--text-xs', '10px'], ['--text-sm', '11px'], ['--text-base', '13px'], ['--text-lg', '15px'], ['--text-xl', '18px'], ['--text-2xl', '22px'], ['--text-3xl', '28px']].forEach(([v, px]) => {
      const row = document.createElement('div');
      row.style.cssText = `font-size:var(${v});color:var(--text)`;
      row.textContent = `${v} (${px}) — The quick brown fox`;
      wrap.appendChild(row);
    });
    return wrap;
  },
};
