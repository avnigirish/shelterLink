import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      thresholds: { lines: 80, functions: 80, branches: 70 },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
