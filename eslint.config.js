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
  {
    // Superproject-owned shared browser scripts (classic <script> files, not
    // modules). Lint without the type-aware config (they have no tsconfig).
    files: ['public/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: {
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        console: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Portal-owned classifier app scripts (the "ML/AI page") — classic <script>
    // files ported from the Flask app, not modules; no tsconfig, so no type-aware
    // rules. Bringing 1,777 LOC under the linter (tech-debt A1). `no-undef` is the
    // high-value rule here: it catches typo'd/undefined references in vanilla JS.
    files: ['public/classifiers/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: {
        // Browser APIs used across the classifier scripts.
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        Headers: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        EventSource: 'readonly',
        WebSocket: 'readonly',
        CustomEvent: 'readonly',
        Event: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        FileReader: 'readonly',
        FormData: 'readonly',
        Image: 'readonly',
        ImageData: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        history: 'readonly',
        performance: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
        alert: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        getComputedStyle: 'readonly',
        MutationObserver: 'readonly',
        ResizeObserver: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        DOMParser: 'readonly',
        AbortController: 'readonly',
        // Cross-file globals seeded by sibling scripts loaded before app.js (see
        // ClassifierApp.astro load order). Writable = defined by a classifier script
        // and read by another (the implicit contract Item D/B would turn into imports);
        // readonly = owned by the shared public/js/ scripts.
        API_BASE: 'writable',
        UI_CONFIG: 'writable',
        CLASSIFIER_DATASETS: 'writable',
        apiFetch: 'writable', // app.js → used by sse.js
        consumeSSE: 'writable', // sse.js → used by app.js
        MiniChart: 'writable', // chart.js → used by app.js
        connectionManager: 'writable', // connection.js → used by app.js
        ClassifierInfer: 'writable', // infer.js → used by app.js
        ServiceConfig: 'readonly',
        UIKit: 'readonly',
        SitePass: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'no-undef': 'error',
    },
  },
];
