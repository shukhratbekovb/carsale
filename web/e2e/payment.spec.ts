import { expect, test } from '@playwright/test';

// P0-флоу «Оплата» (analysis/06-sequence-diagrams.md §6.5, FR-10/UC-11, риск
// R-10): выбор шлюза → redirect на имитацию чекаута → return-страница; отказ →
// fallback на второй шлюз → терминальное «оба недоступны».

test('оплата: happy path через Click (§6.5)', async ({ page }) => {
  await page.goto('/ru/catalog/1');
  await page.getByRole('link', { name: /Заказать расширенный отчёт о проверке/ }).click();

  await expect(page).toHaveURL(/\/ru\/payment\/1/);
  await expect(page.getByText('Выберите способ оплаты')).toBeVisible();

  await page.getByRole('button', { name: 'Click', exact: true }).click();

  // Имитация экрана шлюза (PCI DSS: карта вводится на стороне шлюза).
  await expect(page).toHaveURL(/\/ru\/payment\/gateway-sim/);
  await page.getByRole('button', { name: /^Оплатить / }).click();

  await expect(page.getByText('Оплата прошла успешно')).toBeVisible();
});

test('оплата: отказ шлюза → fallback на второй → оба недоступны (R-10)', async ({ page }) => {
  await page.goto('/ru/payment/1');
  await page.getByRole('button', { name: 'Click', exact: true }).click();

  await expect(page).toHaveURL(/gateway-sim/);
  await page.getByRole('button', { name: 'Отменить платёж' }).click();

  // Отказ первого шлюза: понятное сообщение + предложение второго (§6.5 alt 6a).
  await expect(page.getByText('Платёж отклонён')).toBeVisible();
  await page.getByRole('button', { name: 'Попробовать Payme' }).click();

  await expect(page).toHaveURL(/gateway-sim/);
  await page.getByRole('button', { name: 'Отменить платёж' }).click();

  // Оба шлюза не сработали — терминальное состояние R-10.
  await expect(page.getByText('Оплата сейчас недоступна')).toBeVisible();
  await expect(page.getByRole('link', { name: 'В каталог' })).toBeVisible();
});
