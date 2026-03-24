/** @type {import('@storybook/html').Meta} */
export default {
  title: 'Components/Form',
};

function createFormRow(label, inputHtml) {
  const row = document.createElement('div');
  row.className = 'form-row';
  const lbl = document.createElement('label');
  lbl.textContent = label;
  lbl.style.cssText = 'font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;display:block';
  row.appendChild(lbl);
  const tmp = document.createElement('div');
  tmp.innerHTML = inputHtml;
  row.appendChild(tmp.firstElementChild);
  return row;
}

export const TextInputs = {
  render: () => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:12px;max-width:360px';
    wrap.appendChild(createFormRow('Text Input', '<input type="text" placeholder="Enter text\u2026">'));
    wrap.appendChild(createFormRow('Disabled', '<input type="text" value="Read only" disabled>'));
    wrap.appendChild(createFormRow('Number', '<input type="number" value="42" min="0" max="100">'));
    wrap.appendChild(createFormRow('Select', '<select><option>Option A</option><option>Option B</option></select>'));
    return wrap;
  },
};

export const Toggle = {
  render: () => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;align-items:center;gap:10px';
    wrap.innerHTML = '<label class="ui-toggle"><input type="checkbox" checked><span class="ui-toggle-track"><span class="ui-toggle-thumb"></span></span></label><span style="font-size:13px;color:var(--text-secondary)">Enable feature</span>';
    return wrap;
  },
};
