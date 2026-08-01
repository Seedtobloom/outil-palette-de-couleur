import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  test: {
    include: ['front/**/*.test.ts', 'back/**/*.test.ts'],
    environment: 'node',
  },
});
