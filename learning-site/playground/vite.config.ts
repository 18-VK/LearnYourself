import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// Standalone dev page for visualizers (no Astro, no content pipeline): fast to start and light on memory.
export default defineConfig({
  root: 'playground',
  cacheDir: '../.cache/vite-playground',
  plugins: [tailwindcss()],
  server: { port: Number(process.env.LY_PG_PORT ?? 5199), strictPort: true, fs: { allow: ['..'] } },
  logLevel: 'warn',
});
