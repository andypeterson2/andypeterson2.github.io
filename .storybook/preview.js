import '../ui-kit.css';

/** @type {import('@storybook/html').Preview} */
export default {
  parameters: {
    backgrounds: { disable: true },
  },
  globalTypes: {
    theme: {
      description: 'Theme',
      toolbar: {
        title: 'Theme',
        items: [
          { value: 'dark', title: 'Dark', icon: 'moon' },
          { value: 'light', title: 'Light', icon: 'sun' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'dark' },
  decorators: [
    (story, context) => {
      document.documentElement.dataset.theme = context.globals.theme || 'dark';
      return story();
    },
  ],
};
