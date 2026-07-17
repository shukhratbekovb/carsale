import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Полный axe-аудит живых страниц (FE-10, frontend-plan.md §10 «a11y-аудит»,
// WCAG 2.1 AA). В отличие от vitest-axe смоука (jsdom, color-contrast
// выключен), здесь реальный браузерный рендер с каскадом и CSS-переменными —
// проверяется и контраст.
//
// Страницы с client-side загрузкой данных ждут якорный элемент, чтобы axe
// не сканировал состояние «Загружаем...».

const PAGES: Array<{ path: string; readySelector?: string }> = [
  { path: '/ru' },
  { path: '/ru/catalog' },
  { path: '/ru/catalog/1' },
  { path: '/ru/auth/login' },
  { path: '/ru/sell/new' },
  { path: '/ru/favorites' },
  { path: '/ru/profile' },
  { path: '/ru/payment/1' },
  { path: '/ru/chat' },
  { path: '/ru/privacy' },
  { path: '/ru/terms' },
  { path: '/ru/admin', readySelector: 'text=Всего объявлений' },
  { path: '/ru/admin/moderation', readySelector: 'text=Chevrolet Cobalt' },
  { path: '/ru/admin/moderation/mod-1', readySelector: 'text=Причина флага' },
  { path: '/ru/admin/users', readySelector: 'text=Otabek Ergashev' },
];

for (const { path, readySelector } of PAGES) {
  test(`axe WCAG 2.1 A/AA: ${path}`, async ({ page }) => {
    await page.goto(path);
    if (readySelector) {
      await page.locator(readySelector).first().waitFor();
    }

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(
      results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => n.target),
      }))
    ).toEqual([]);
  });
}
