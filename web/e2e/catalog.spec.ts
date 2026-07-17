import { expect, test } from '@playwright/test';
import { gotoHydrated } from './utils';

// P0-флоу «Каталог» (analysis/06-sequence-diagrams.md §6.6, FR-04/FR-08).
// Все сценарии ходят по /ru-маршрутам: ассерты на русских строках из
// messages/ru.json, а дефолтная uz-локаль без префикса зависела бы от
// Accept-Language браузера.

test('каталог: фильтр по марке синхронизируется с URL и сужает выдачу', async ({ page }) => {
  await gotoHydrated(page, '/ru/catalog');
  await expect(page.getByRole('heading', { name: 'Каталог объявлений' })).toBeVisible();

  // Полный мок-каталог содержит не только Chevrolet.
  const cardHeadings = page.getByRole('main').getByRole('heading', { level: 2 });
  await expect(cardHeadings.first()).toBeVisible();

  await page.getByLabel('Марка', { exact: true }).selectOption('Chevrolet');
  await page.getByRole('button', { name: 'Применить' }).click();

  // FR-06: применённый фильтр кодируется в URL без перезагрузки страницы.
  await expect(page).toHaveURL(/make=Chevrolet/);
  await expect(cardHeadings.first()).toBeVisible();
  for (const title of await cardHeadings.allTextContents()) {
    expect(title).toContain('Chevrolet');
  }
});

test('карточка объявления: ML-флаги приходят вместе со страницей (FR-08/NFR-2)', async ({
  page,
}) => {
  await gotoHydrated(page, '/ru/catalog/1');

  // Deal Rating рендерится в SSR-ответе, не лениво после LCP.
  await expect(page.getByText('Отличная сделка').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Характеристики' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Написать продавцу' })).toBeVisible();
  await expect(
    page.getByRole('link', { name: /Заказать расширенный отчёт о проверке/ })
  ).toBeVisible();
});

test('пустая выдача: показывается блок похожих объявлений (UC-01 alt 3a)', async ({ page }) => {
  // Заведомо невыполнимая комбинация фильтров: цена до 1 сума.
  await gotoHydrated(page, '/ru/catalog?priceMax=1');
  await expect(
    page.getByText('По вашему запросу ничего не найдено. Показываем похожие объявления.')
  ).toBeVisible();
  // Похожие объявления реально отрисованы.
  await expect(page.getByRole('main').getByRole('heading', { level: 2 }).first()).toBeVisible();
});
