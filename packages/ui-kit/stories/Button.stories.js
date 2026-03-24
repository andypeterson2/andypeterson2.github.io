/** @type {import('@storybook/html').Meta} */
export default {
  title: 'Components/Button',
  argTypes: {
    label: { control: 'text' },
    variant: {
      control: 'select',
      options: ['btn-primary', 'btn-secondary', 'btn-danger', 'btn-icon'],
    },
    size: {
      control: 'select',
      options: ['', 'btn-sm', 'btn-xs', 'btn-lg'],
    },
    disabled: { control: 'boolean' },
    loading: { control: 'boolean' },
  },
};

function createButton({ label = 'Button', variant = 'btn-primary', size = '', disabled = false, loading = false }) {
  const btn = document.createElement('button');
  btn.className = ['btn', variant, size, loading ? 'btn-loading' : ''].filter(Boolean).join(' ');
  btn.textContent = label;
  btn.disabled = disabled;
  return btn;
}

export const Primary = { render: (args) => createButton(args), args: { label: 'Primary', variant: 'btn-primary' } };
export const Secondary = { render: (args) => createButton(args), args: { label: 'Secondary', variant: 'btn-secondary' } };
export const Danger = { render: (args) => createButton(args), args: { label: 'Delete', variant: 'btn-danger' } };
export const Icon = {
  render: (args) => createButton(args),
  args: { label: '\u2630', variant: 'btn-icon' },
};
export const Small = { render: (args) => createButton(args), args: { label: 'Small', variant: 'btn-primary', size: 'btn-sm' } };
export const Large = { render: (args) => createButton(args), args: { label: 'Large', variant: 'btn-primary', size: 'btn-lg' } };
export const Disabled = { render: (args) => createButton(args), args: { label: 'Disabled', variant: 'btn-primary', disabled: true } };
export const Loading = { render: (args) => createButton(args), args: { label: 'Loading\u2026', variant: 'btn-primary', loading: true } };

export const AllVariants = {
  render: () => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;align-items:center';
    ['btn-primary', 'btn-secondary', 'btn-danger', 'btn-icon'].forEach((v) => {
      wrap.appendChild(createButton({ label: v.replace('btn-', ''), variant: v }));
    });
    return wrap;
  },
};
