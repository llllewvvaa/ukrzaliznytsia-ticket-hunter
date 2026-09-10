import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5188,
    proxy: {
      '/api': 'http://localhost:8848',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
