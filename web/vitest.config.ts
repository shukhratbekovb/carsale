import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    css: true,
    // e2e/ — Playwright-сьюты (*.spec.ts), у них свой раннер (playwright.config.ts);
    // дефолтный include vitest иначе подхватил бы их как unit-тесты.
    exclude: ['**/node_modules/**', '**/.next/**', 'e2e/**'],
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
