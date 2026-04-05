import eslintPluginAstro from 'eslint-plugin-astro';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import * as designSystem from './scripts/eslint-plugin-design-system.js';

export default [
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },
  ...eslintPluginAstro.configs.recommended,
  {
    // Disable type-aware rules for scripts extracted from .astro files,
    // since they are virtual files without tsconfig project coverage.
    files: ['**/*.astro/*.ts', '**/*.astro/*.js'],
    rules: {
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/await-thenable': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
    },
  },
  {
    files: ['src/pages/**/*.astro', 'src/layouts/**/*.astro'],
    plugins: {
      'design-system': { rules: designSystem.rules },
    },
    rules: {
      'design-system/prefer-button': 'warn',
    },
  },
];
