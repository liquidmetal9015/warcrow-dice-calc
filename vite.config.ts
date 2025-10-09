import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  appType: 'spa',
  server: { port: 5173 },
  build: {
    outDir: 'dist',
    sourcemap: true,
    emptyOutDir: true
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html']
    }
  }
});


