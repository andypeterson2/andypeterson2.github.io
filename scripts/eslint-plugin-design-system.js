/**
 * Local ESLint plugin enforcing design system component usage.
 *
 * design-system/prefer-button — a raw <button> in a page or layout should be the
 * <Button> component. Disable with an eslint-disable comment plus a justification
 * where a control genuinely cannot be one.
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

    // Skip only the Button component itself; other components get the rule at 'warn'.
    if (filename.endsWith(`${COMPONENT_DIR}Button.astro`)) return {};

    return {
      JSXElement(node) {
        const el = node.openingElement;
        if (!el || !el.name || el.name.name !== 'button') return;
        // Exempt buttons carrying attributes the <Button> component cannot express
        // (its props are variant/size/block/href/class/type/disabled/aria-label/id):
        // a role, tabindex, data-* hooks, or any aria-* other than aria-label. Those
        // are legitimately raw (menubar checkbox toggles, disclosure buttons,
        // data-attribute-driven modal triggers, decorative aria-hidden chrome), so
        // the rule shouldn't nudge them toward <Button>.
        const unexpressible = (el.attributes || []).some((a) => {
          if (a.type !== 'JSXAttribute' || !a.name || !a.name.name) return false;
          const n = String(a.name.name);
          return (
            n === 'role' ||
            n === 'tabindex' ||
            n.startsWith('data-') ||
            (n.startsWith('aria-') && n !== 'aria-label')
          );
        });
        if (unexpressible) return;
        // Exempt content-less buttons: an empty <button> is a decorative/icon control
        // (e.g. CSS-triangle carousel arrows) that <Button>'s label-slot model doesn't
        // fit — converting would inject its inline-flex/gap padding and break the shape.
        const hasContent = (node.children || []).some((c) =>
          c.type === 'JSXText' ? c.value.trim() !== '' : true,
        );
        if (!hasContent) return;
        context.report({ node: el, messageId: 'preferButton' });
      },
    };
  },
};

export const rules = {
  'prefer-button': preferButton,
};
