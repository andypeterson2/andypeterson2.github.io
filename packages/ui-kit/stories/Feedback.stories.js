/** @type {import('@storybook/html').Meta} */
export default {
  title: 'Components/Feedback',
};

export const Toast = {
  render: () => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:8px;max-width:320px';
    ['', 'ui-toast-success', 'ui-toast-warn', 'ui-toast-error'].forEach((cls) => {
      const t = document.createElement('div');
      t.className = ['ui-toast', 'visible', cls].filter(Boolean).join(' ');
      t.style.position = 'relative';
      t.textContent = cls ? cls.replace('ui-toast-', '') + ' toast' : 'Default toast';
      wrap.appendChild(t);
    });
    return wrap;
  },
};

export const Tooltip = {
  render: () => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'padding:40px;display:flex;gap:16px';
    ['Top tooltip', 'Another tooltip'].forEach((text) => {
      const btn = document.createElement('button');
      btn.className = 'btn btn-secondary';
      btn.textContent = 'Hover me';
      btn.dataset.tooltip = text;
      wrap.appendChild(btn);
    });
    return wrap;
  },
};

export const Spinner = {
  render: () => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:16px;align-items:center';
    wrap.innerHTML = '<span class="icon icon-spin"><i class="fa-solid fa-spinner"></i></span><span style="color:var(--text-secondary);font-size:13px">Loading\u2026</span>';
    return wrap;
  },
};

export const Progress = {
  render: () => {
    const wrap = document.createElement('div');
    wrap.style.maxWidth = '400px';
    wrap.innerHTML = `
      <div class="progress-area">
        <div class="progress-bar-wrap">
          <div class="progress-bar" style="width:65%"></div>
        </div>
      </div>
    `;
    return wrap.firstElementChild;
  },
};
