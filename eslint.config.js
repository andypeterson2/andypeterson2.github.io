import eslintPluginAstro from 'eslint-plugin-astro';
import eslintPluginSvelte from 'eslint-plugin-svelte';
import tseslint from 'typescript-eslint';
import sonarjs from 'eslint-plugin-sonarjs';
import * as designSystem from './scripts/eslint-plugin-design-system.js';

// Complexity budgets (fleet lint baseline). Cognitive complexity is the
// primary metric — unlike cyclomatic it punishes nesting, not flat readable
// constructs — so the core `complexity` rule stays off (no double-charging).
const complexityBudgets = {
  'sonarjs/cognitive-complexity': ['error', 15],
  'max-depth': ['error', 4],
  'max-params': ['error', 5],
  'max-nested-callbacks': ['error', 3],
};

const SRC_TS = ['src/**/*.ts', 'src/**/*.tsx'];

export default [
  // ── src TypeScript: strict-type-checked + stylistic (fleet lint baseline).
  // The presets are pinned via the typescript-eslint minor (~) because their
  // contents are not semver-stable — review rule changes on upgrade.
  ...tseslint.configs.strictTypeChecked.map((c) => ({ ...c, files: SRC_TS })),
  ...tseslint.configs.stylisticTypeChecked.map((c) => ({ ...c, files: SRC_TS })),
  {
    files: SRC_TS,
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { sonarjs },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // Calibration, not weakening: numbers/booleans in template strings are
      // fine; void arrow shorthand (`() => this.save()`) is idiomatic here.
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true, allowBoolean: true },
      ],
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
      // `str || fallback` here is deliberate empty-string defaulting (env vars,
      // form fields); ?? would change behavior. Non-string cases still flag.
      '@typescript-eslint/prefer-nullish-coalescing': [
        'error',
        { ignorePrimitives: { string: true } },
      ],
      // OFF: its auto-fix converts type aliases to interfaces, but Personal and
      // CoverletterHeader (types.ts) are aliases ON PURPOSE — all-optional
      // string shapes only get an implicit index signature as aliases.
      '@typescript-eslint/consistent-type-definitions': 'off',
      ...complexityBudgets,
    },
  },
  ...eslintPluginAstro.configs.recommended,
  {
    // Scripts extracted from .astro files are virtual modules without tsconfig
    // project coverage — the whole type-aware tier must be off for them.
    ...tseslint.configs.disableTypeChecked,
    files: ['**/*.astro/*.ts', '**/*.astro/*.js'],
  },
  {
    files: ['src/pages/**/*.astro', 'src/layouts/**/*.astro'],
    plugins: {
      'design-system': { rules: designSystem.rules },
    },
    rules: {
      // Error tier: portfolio chrome must use <Button> (the rule itself exempts
      // buttons whose attributes <Button> cannot express).
      'design-system/prefer-button': 'error',
      'design-system/prefer-tag': 'warn',
    },
  },
  {
    // Components get the nudge tier — bespoke controls are common here, so a
    // warning marks candidates without blocking.
    files: ['src/components/**/*.astro'],
    plugins: {
      'design-system': { rules: designSystem.rules },
    },
    rules: {
      'design-system/prefer-button': 'warn',
    },
  },
  {
    // App pages (src/pages/projects/*/app.astro) host full-bleed, self-contained apps
    // with their own bespoke control styling (e.g. the nonogram's .nono-btn — a
    // standalone button system, not additive to system.css .btn), not portfolio chrome,
    // so the portfolio <Button> rule doesn't apply to their controls.
    files: ['src/pages/projects/*/app.astro'],
    rules: {
      'design-system/prefer-button': 'off',
    },
  },
  // ── Svelte (the CV editor island): svelte/recommended + the fleet
  // complexity budgets + the type-aware unsafe floor (projectService).
  ...eslintPluginSvelte.configs.recommended.map((c) => ({
    ...c,
    files: ['src/**/*.svelte'],
  })),
  {
    files: ['src/**/*.svelte'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        projectService: true,
        extraFileExtensions: ['.svelte'],
      },
    },
    plugins: { sonarjs, '@typescript-eslint': tseslint.plugin },
    rules: {
      // The TS-aware rule — core no-unused-vars false-positives on parameter
      // names inside type annotations.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // OFF: these svelte-ignore comments suppress COMPILER a11y warnings at
      // build time; without svelte/valid-compile eslint can't see that use
      // and flags them as unused. Removing them would resurface the build
      // warnings.
      'svelte/no-unused-svelte-ignore': 'off',
      // The type-aware unsafe floor (matches the src TS tier). The full
      // strict preset is not applied to .svelte; these are the rules that
      // catch real any-leaks at the markup boundary.
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      ...complexityBudgets,
    },
  },
];
