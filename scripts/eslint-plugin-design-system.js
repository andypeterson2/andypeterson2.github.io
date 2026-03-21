/**
 * Local ESLint plugin enforcing design system component usage.
 *
 * Warns when raw HTML elements are used in .astro pages/layouts
 * where a design system component should be used instead.
 *
 * Rules:
 *   design-system/prefer-button   — <button> → <Button>
 *   design-system/prefer-tag      — <span class="tag"> → <Tag>
 *
 * Disable with eslint-disable comment + justification when genuinely needed.
 */

const COMPONENT_DIR = 'src/components/';

const preferButton = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prefer <Button> component over raw <button> elements',
    },
    messages: {
      preferButton:
        'Use the <Button> design system component instead of a raw <button> element.',
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename();

    // Skip the Button component itself
    if (filename.includes(COMPONENT_DIR)) return {};

    return {
      JSXElement(node) {
        if (
          node.openingElement &&
          node.openingElement.name &&
          node.openingElement.name.name === 'button'
        ) {
          context.report({ node: node.openingElement, messageId: 'preferButton' });
        }
      },
    };
  },
};

const preferTag = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prefer <Tag> component over raw tag-like <span> elements',
    },
    messages: {
      preferTag:
        'Use the <Tag> design system component instead of a raw <span> with class "tag".',
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename();

    if (filename.includes(COMPONENT_DIR)) return {};

    return {
      JSXElement(node) {
        if (
          node.openingElement &&
          node.openingElement.name &&
          node.openingElement.name.name === 'span'
        ) {
          const classAttr = node.openingElement.attributes.find(
            (a) =>
              a.type === 'JSXAttribute' &&
              a.name &&
              a.name.name === 'class' &&
              a.value &&
              typeof a.value.value === 'string' &&
              a.value.value.includes('tag'),
          );
          if (classAttr) {
            context.report({ node: node.openingElement, messageId: 'preferTag' });
          }
        }
      },
    };
  },
};

export const rules = {
  'prefer-button': preferButton,
  'prefer-tag': preferTag,
};
