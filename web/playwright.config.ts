import { defineConfig, devices } from '@playwright/test';

// E2E-конфиг FE-10 (frontend-plan.md §10): P0-флоу из analysis/06-sequence-diagrams.md,
// кросс-браузер (NFR-23) и вьюпорты (NFR-24, отдельный viewports.spec.ts).
//
// Локально по умолчанию гоняется только chromium (`npm run e2e`) против уже
// запущенного dev-сервера на :3100 (reuseExistingServer) — полный `next build`
// параллельно с dev запрещён правилом CLAUDE.md (общий .next/). Если сервер не
// запущен, Playwright поднимет dev сам. Полная браузерная матрица — `npm run
// e2e:all` (нужны `npx playwright install firefox webkit`).
//
// В CI (playwright-smoke) сервер собирается заранее (`next build`) и стартует
// production-режимом — см. .github/workflows/ci.yml.

const PORT = process.env.E2E_PORT ?? '3100';
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Ретраи только в CI: локальные падения должны быть видны сразу, а не
  // маскироваться повтором.
  retries: process.env.CI ? 2 : 0,
  // Локально не больше 4 воркеров: все проекты бьют в один dev-сервер, и
  // компиляция маршрутов на лету под полной матрицей давала таймауты.
  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // NFR-23: кросс-браузерная матрица. Edge на движке Chromium покрывается
    // проектом chromium; последние 2 версии — ответственность регулярного
    // обновления @playwright/test.
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: process.env.CI ? `npm run start -- -p ${PORT}` : `npm run dev -- -p ${PORT}`,
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
