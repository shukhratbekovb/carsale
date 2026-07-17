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

      const { overflow, offenders } = await page.evaluate(() => {
        const el = document.documentElement;
        const wide: string[] = [];
        // Диагностика для падений на CI: какие элементы выходят за вьюпорт —
        // из одного числа переполнения виновника не восстановить.
        document.querySelectorAll('*').forEach((node) => {
          const r = node.getBoundingClientRect();
          if (r.right > el.clientWidth + 1 || r.left < -1) {
            const cls = typeof node.className === 'string' ? node.className : '';
            wide.push(
              `<${node.tagName.toLowerCase()} class="${cls.slice(0, 80)}"> [${Math.round(r.left)}..${Math.round(r.right)}]`
            );
          }
        });
        return { overflow: el.scrollWidth - el.clientWidth, offenders: wide.slice(0, 6) };
      });
      // 1px допуска на субпиксельное округление браузера.
      expect(
        overflow,
        `scrollWidth превышает clientWidth на ${overflow}px; элементы за вьюпортом:\n${offenders.join('\n')}`
      ).toBeLessThanOrEqual(1);
    });
  }
}
