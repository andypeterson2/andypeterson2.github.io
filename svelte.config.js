// Explicit Svelte config so vite-plugin-svelte stops logging "no Svelte config found -
// using default configuration" on every dev start. vitePreprocess() is exactly what
// @astrojs/svelte applies by default (TypeScript in <script lang="ts">, etc.), so this
// is behaviour-neutral — it just makes the config the integration was already using
// explicit and silences the notice.
import { vitePreprocess } from '@astrojs/svelte';

export default {
  preprocess: vitePreprocess(),
};
