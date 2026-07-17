import { expect, test } from '@playwright/test';
import { gotoHydrated, proveHydrated } from './utils';

// P0-флоу «Регистрация/вход по OTP» (analysis/06-sequence-diagrams.md §6.1,
// включая error-ветку неверного кода) + согласия NFR-20 (FE-9).
// Мок-код подтверждения фиксирован: '000000' (lib/mock/otp.ts).

const PHONE = '+998901234567';

test('вход: без согласия на обработку ПД сабмит блокируется (NFR-20)', async ({ page }) => {
  await gotoHydrated(page, '/ru/auth/login');
  await page.getByLabel('Номер телефона').fill(PHONE);
  await page.getByRole('button', { name: 'Получить код' }).click();

  await expect(
    page.getByText('Для продолжения необходимо согласие на обработку персональных данных')
  ).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/login/);
});

test('вход: ошибка кода уменьшает попытки, верный код завершает вход (§6.1)', async ({ page }) => {
  await gotoHydrated(page, '/ru/auth/login');
  // Сабмит пустой формы → ошибка формата телефона = гидратация завершена.
  await proveHydrated(page, { role: 'button', name: 'Получить код' }, 'Введите номер в формате');
  await page.getByLabel('Номер телефона').fill(PHONE);
  await page.getByRole('checkbox', { name: /Соглашаюсь на обработку персональных данных/ }).check();
  await page.getByRole('button', { name: 'Получить код' }).click();

  await expect(page).toHaveURL(/\/auth\/otp/);
  await expect(page.getByText(`Код отправлен на ${PHONE}`)).toBeVisible();

  // Error-ветка: неверный код.
  await page.getByLabel('Код из SMS').fill('111111');
  await page.getByRole('button', { name: 'Подтвердить' }).click();
  await expect(page.getByText('Неверный код. Осталось попыток: 2')).toBeVisible();

  // Happy path: фиксированный мок-код.
  await page.getByLabel('Код из SMS').fill('000000');
  await page.getByRole('button', { name: 'Подтвердить' }).click();

  // Реальной сессии нет (нет Core API) — успех подтверждается уходом с /auth/otp
  // на главную (returnTo не передавался).
  await expect(page).not.toHaveURL(/\/auth\/otp/);
  await expect(page.getByRole('heading', { name: 'Автомобили, которым можно доверять' })).toBeVisible();
});
