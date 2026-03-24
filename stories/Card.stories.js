/** @type {import('@storybook/html').Meta} */
export default {
  title: 'Components/Card',
  argTypes: {
    title: { control: 'text' },
    content: { control: 'text' },
    interactive: { control: 'boolean' },
  },
};

function createCard({ title = 'Card Title', content = 'Card body content goes here.', interactive = false }) {
  const card = document.createElement('div');
  card.className = 'card' + (interactive ? ' card-interactive' : '');

  if (title) {
    const header = document.createElement('div');
    header.className = 'card-header';
    const h2 = document.createElement('h2');
    h2.textContent = title;
    header.appendChild(h2);
    card.appendChild(header);
  }

  const body = document.createElement('p');
  body.textContent = content;
  body.style.cssText = 'padding:12px 0;color:var(--text-secondary);font-size:13px';
  card.appendChild(body);
  return card;
}

export const Default = { render: (args) => createCard(args), args: {} };
export const Interactive = { render: (args) => createCard(args), args: { title: 'Clickable Card', interactive: true } };

export const CardStack = {
  render: () => {
    const wrap = document.createElement('div');
    wrap.style.maxWidth = '400px';
    for (let i = 1; i <= 3; i++) {
      wrap.appendChild(createCard({ title: `Card ${i}`, content: `Content for card ${i}.` }));
    }
    return wrap;
  },
};
