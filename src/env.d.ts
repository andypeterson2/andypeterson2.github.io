// Ambient type wiring for the raw TypeScript program (ESLint's type-aware
// pass and bare tsc). Svelte 5's rune declarations ($state, $derived, ...)
// live in svelte's types entry and are only loaded when something references
// the package — the .svelte.ts rune modules use the runes as globals without
// importing 'svelte', so without this reference the runes type as unresolved
// (and every value that flows through them becomes unsafe-any).
/// <reference types="svelte" />
