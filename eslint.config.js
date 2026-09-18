import eslintPluginAstro from 'eslint-plugin-astro';
import eslintPluginSvelte from 'eslint-plugin-svelte';
import tseslint from 'typescript-eslint';
import sonarjs from 'eslint-plugin-sonarjs';
import * as designSystem from './scripts/eslint-plugin-design-system.js';

// Complexity budgets (fleet lint baseline). Cognitive complexity is the
// primary metric, since it punishes nesting rather than plain length in readable
// constructs — so the core `complexity` rule stays off (no double-charging).
const complexityBudgets = {
  'sonarjs/cognitive-complexity': ['error', 15],
  'max-depth': ['error', 4],
  'max-params': ['error', 5],
  'max-nested-callbacks': ['error', 3],
};

const SRC_TS = ['src/**/*.ts', 'src/**/*.tsx'];

export default [
  // ── src TypeScript: strict-type-checked + stylistic. The presets are pinned to the
  // typescript-eslint minor (~) because their contents are not semver-stable.
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
      // Calibrated for this codebase: numbers/booleans in template strings are
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
      // OFF: its auto-fix turns type aliases into interfaces, but all-optional string shapes
      // (Personal, CoverletterHeader) get an implicit index signature only as aliases.
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
    // App pages host self-contained apps with their own button systems (the nonogram's
    // .nono-btn) rather than portfolio chrome, so the <Button> rule doesn't apply.
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
      // OFF: svelte-ignore comments suppress compiler a11y warnings, a use eslint can't see
      // without svelte/valid-compile, so it wrongly flags them as unused.
      'svelte/no-unused-svelte-ignore': 'off',
      // The type-aware unsafe floor of the src TS tier: the strict preset isn't applied to
      // .svelte, and these rules catch real any-leaks at the markup boundary.
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      ...complexityBudgets,
    },
  },
];
