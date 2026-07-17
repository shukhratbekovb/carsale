import { expect, test } from '@playwright/test';

// P0-флоу «Модерация» (UC-15, P0 в analysis/03-use-case-model.md) и
// «Управление пользователями» (UC-16). Состояние мок-«базы» админки живёт
// in-memory на загруженной странице — каждый тест стартует со свежего seed.

test('модерация: отклонение с обязательной причиной (UC-15 шаг 4)', async ({ page }) => {
  await page.goto('/ru/admin/moderation');
  await expect(page.getByRole('heading', { name: 'Очередь модерации' })).toBeVisible();

  // Очередь PENDING «сначала старые» — первый элемент это mod-1 (12.07).
  await page.getByRole('link', { name: /Chevrolet Cobalt/ }).click();
  await expect(page.getByRole('heading', { name: 'Chevrolet Cobalt, 2019' })).toBeVisible();

  // Причина флага: дубль фото со ссылкой на оригинал (UC-15 шаг 3).
  await expect(page.getByRole('link', { name: 'Открыть объявление-оригинал' })).toHaveAttribute(
    'href',
    /\/ru\/catalog\/1/
  );

  await page.getByRole('button', { name: 'Отклонить' }).click();
  // Обязательная причина: submit заблокирован до выбора.
  await expect(page.getByRole('button', { name: 'Подтвердить отклонение' })).toBeDisabled();

  await page.getByLabel('Причина отклонения').selectOption({ label: 'Дубликат объявления' });
  await page.getByRole('button', { name: 'Подтвердить отклонение' }).click();

  await expect(page.getByText('Отклонено').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Решение' })).toBeVisible();
  // Продавец получает уведомление с причиной (демо через общий notification-мок).
  await expect(page.getByText('Объявление отклонено')).toBeVisible();
});

test('модерация: публикация снимает флаг (UC-15 шаг 4)', async ({ page }) => {
  await page.goto('/ru/admin/moderation/mod-2');
  await expect(page.getByRole('heading', { name: 'Chevrolet Gentra, 2022' })).toBeVisible();
  // Аномальная цена: показан процент отклонения.
  await expect(page.getByText(/ниже рыночной оценки/)).toBeVisible();

  await page.getByRole('button', { name: 'Опубликовать' }).click();
  await expect(page.getByText('Опубликовано').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Опубликовать' })).toHaveCount(0);
});

test('пользователи: ban и restore обновляют строку без перезагрузки (UC-16)', async ({ page }) => {
  await page.goto('/ru/admin/users');
  await expect(page.getByRole('heading', { name: 'Пользователи' })).toBeVisible();

  const row = page.getByRole('row', { name: /Otabek Ergashev/ });
  await expect(row.getByText('Активен')).toBeVisible();

  await row.getByRole('button', { name: 'Забанить' }).click();
  await expect(row.getByText('Забанен')).toBeVisible();

  await row.getByRole('button', { name: 'Разблокировать' }).click();
  await expect(row.getByText('Активен')).toBeVisible();
});
