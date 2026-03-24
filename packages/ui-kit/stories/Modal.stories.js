/** @type {import('@storybook/html').Meta} */
export default {
  title: 'Components/Modal',
};

function createModal({ title = 'Confirm Action', body = 'Are you sure you want to proceed?', showFooter = true }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.position = 'relative';
  overlay.style.height = '300px';

  const modal = document.createElement('div');
  modal.className = 'modal';

  const header = document.createElement('div');
  header.className = 'modal-header';
  const titleEl = document.createElement('span');
  titleEl.className = 'modal-title';
  titleEl.textContent = title;
  const close = document.createElement('button');
  close.className = 'btn btn-icon';
  close.textContent = '\u00d7';
  header.appendChild(titleEl);
  header.appendChild(close);
  modal.appendChild(header);

  const content = document.createElement('div');
  content.style.cssText = 'padding:12px 0;color:var(--text-secondary);font-size:13px';
  content.textContent = body;
  modal.appendChild(content);

  if (showFooter) {
    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    const cancel = document.createElement('button');
    cancel.className = 'btn btn-secondary';
    cancel.textContent = 'Cancel';
    const confirm = document.createElement('button');
    confirm.className = 'btn btn-primary';
    confirm.textContent = 'Confirm';
    footer.appendChild(cancel);
    footer.appendChild(confirm);
    modal.appendChild(footer);
  }

  overlay.appendChild(modal);
  return overlay;
}

export const Default = { render: () => createModal({}) };
export const WithLongContent = {
  render: () => createModal({
    title: 'Terms of Service',
    body: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(10),
  }),
};
