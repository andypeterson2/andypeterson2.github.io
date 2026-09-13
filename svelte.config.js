// Silences vite-plugin-svelte's "no Svelte config found" notice on every dev start.
// vitePreprocess() is what @astrojs/svelte applies by default, so behavior is unchanged.
import { vitePreprocess } from '@astrojs/svelte';

export default {
  preprocess: vitePreprocess(),
};
