import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    css: true,
    setupFiles: ['./src/test/setup.ts'],
    server: {
      deps: {
        // ESM-сборка next-intl импортирует 'next/navigation' без расширения;
        // вне vite-пайплайна Node не резолвит этот сабпат — прогоняем пакет
        // через vite, заодно vi.mock('next/navigation') работает и внутри него.
        inline: ['next-intl', 'use-intl'],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
