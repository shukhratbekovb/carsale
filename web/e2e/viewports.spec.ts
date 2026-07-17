import { expect, test } from '@playwright/test';

// Вьюпорт-тесты NFR-24 (frontend-plan.md §10): 360 / 768 / 1280 / 1440 —
// без горизонтального скролла на ключевых сценариях (каталог, карточка,
// форма объявления). Ширины зафиксированы требованием, не выдуманы.

const WIDTHS = [360, 768, 1280, 1440] as const;
const PAGES = ['/ru', '/ru/catalog', '/ru/catalog/1', '/ru/sell/new'] as const;

for (const width of WIDTHS) {
  for (const path of PAGES) {
    test(`нет горизонтального скролла: ${path} @ ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      // Дать layout'у стабилизироваться (шрифты/изображения меняют ширину).
      await page.waitForLoadState('networkidle');

      const overflow = await page.evaluate(() => {
        const el = document.documentElement;
        return el.scrollWidth - el.clientWidth;
      });
      // 1px допуска на субпиксельное округление браузера.
      expect(overflow, `scrollWidth превышает clientWidth на ${overflow}px`).toBeLessThanOrEqual(1);
    });
  }
}
