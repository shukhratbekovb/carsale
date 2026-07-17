import { expect, test } from '@playwright/test';

// P0-флоу «Чат» (analysis/06-sequence-diagrams.md §6.4, UC-06): вход с карточки
// объявления, отправка сообщения, real-time ответ «продавца» (детерминированный
// мок pub/sub вместо будущего WebSocket Hub).

test('чат: сообщение с карточки объявления и авто-ответ продавца (§6.4)', async ({ page }) => {
  await page.goto('/ru/catalog/1');
  await page.getByRole('button', { name: 'Написать продавцу' }).click();

  await expect(page).toHaveURL(/\/ru\/chat\//);
  const input = page.getByPlaceholder('Напишите сообщение...');
  await expect(input).toBeVisible();

  await input.fill('Здравствуйте! Автомобиль ещё продаётся?');
  await page.getByRole('button', { name: 'Отправить' }).click();

  await expect(page.getByText('Здравствуйте! Автомобиль ещё продаётся?')).toBeVisible();

  // Детерминированный авто-ответ из SELLER_REPLIES (lib/mock/chat.ts) приходит
  // через mock pub/sub с задержкой ~1.2-2.7 сек. Тред listing-1 засеян двумя
  // сообщениями, наше — третье, поэтому ответ — SELLER_REPLIES[3 % 5].
  // .first(): текст ответа появляется и пузырём в окне, и превью в списке тредов.
  await expect(page.getByText('Все документы в порядке, вопросов нет.').first()).toBeVisible({
    timeout: 10_000,
  });
});

test('inbox: новый тред появляется в списке после первого сообщения', async ({ page }) => {
  // Listing 2 НЕ имеет засеянного треда (в отличие от listing 1) — проверяем
  // именно создание нового треда (UC-06: «найти/создать ChatThread»).
  await page.goto('/ru/catalog/2');
  await page.getByRole('button', { name: 'Написать продавцу' }).click();
  await expect(page).toHaveURL(/\/ru\/chat\//);

  const input = page.getByPlaceholder('Напишите сообщение...');
  await expect(input).toBeVisible();
  await input.fill('Добрый день!');
  await page.getByRole('button', { name: 'Отправить' }).click();
  await expect(page.getByText('Добрый день!')).toBeVisible();

  // Мягкая навигация в inbox — in-memory состояние мока живёт в рамках
  // загруженной страницы, hard reload его сбросил бы.
  await page.getByRole('link', { name: 'Все переписки' }).click();
  await expect(page).toHaveURL(/\/ru\/chat$/);
  // Новый тред объявления №2 в списке (fallback-заголовок мока для листингов
  // вне SELLER_DIRECTORY) рядом с двумя засеянными.
  await expect(page.getByRole('link', { name: /Объявление #2/ })).toBeVisible();
});
