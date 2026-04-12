import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  build: {
    target: 'es2020',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        viewer: resolve(__dirname, 'ship-viewer.html'),
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
