import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Use workspace packages directly via node_modules (symlinked by pnpm)
  resolve: {
    alias: {
      '@ytspar/devbar': resolve(__dirname, '../devbar/src'),
      '@ytspar/sweetlink': resolve(__dirname, '../sweetlink/src'),
    },
  },

  // Optimize deps to include workspace packages
  optimizeDeps: {
    include: ['html2canvas-pro', 'axe-core'],
  },

  // Build configuration for GitHub Pages
  build: {
    outDir: 'dist',
    sourcemap: true,
  },

  // Dev server configuration
  server: {
    port: 5173,
    open: true,
  },
});
