/**
 * system-six — thin Web Components over the System 6 design system.
 *
 * Importing this module registers every custom element (side effect). The
 * classes are also exported for typing and direct use.
 *
 * Styling lives entirely in `system-six/styles/styles.css` — the components
 * only emit the classes it defines. Load that stylesheet (plus system.css) on
 * the page; icons are inlined SVGs, so no icon font is required.
 */
import './elements/window';
import './elements/button';
import './elements/dither';
import './elements/section-rule';
import './elements/icon-grid';
import './elements/finder-icon';
import './elements/status';
import './elements/theme-toggle';

export { S6Window } from './elements/window';
export { S6Button } from './elements/button';
export { S6Dither, type DitherDensity } from './elements/dither';
export { S6SectionRule } from './elements/section-rule';
export { S6IconGrid } from './elements/icon-grid';
export { S6FinderIcon } from './elements/finder-icon';
export { S6Status, type StatusState } from './elements/status';
export { S6ThemeToggle } from './elements/theme-toggle';
