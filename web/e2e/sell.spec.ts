import path from 'path';
import { expect, test } from '@playwright/test';
import { gotoHydrated, proveHydrated } from './utils';

// P0-флоу «Размещение объявления» (analysis/06-sequence-diagrams.md §6.2):
// 4 шага мастера от характеристик до экрана «на модерации», включая загрузку
// фото с авто-блюром (FR-03) и оценку цены (FR-05).

const FIXTURE_PHOTO = path.join(__dirname, 'fixtures', 'car.png');

test('мастер размещения: полный happy path до экрана модерации (§6.2)', async ({ page }) => {
  await gotoHydrated(page, '/ru/sell/new');
  await expect(page.getByRole('heading', { name: 'Разместить объявление' })).toBeVisible();
  // Сабмит пустой формы → валидационная ошибка = гидратация завершена,
  // ввод больше не потеряется (см. proveHydrated).
  await proveHydrated(page, { role: 'button', name: 'Далее' }, 'Укажите марку');

  // Шаг 1 — характеристики.
  await page.getByLabel('Марка').fill('Chevrolet');
  await page.getByLabel('Модель').fill('Cobalt');
  await page.getByLabel('Год выпуска').fill('2020');
  await page.getByLabel('Пробег, км').fill('50000');
  await page.getByLabel('Состояние').selectOption({ label: 'Хорошее' });
  await page.getByLabel('Коробка передач').selectOption({ label: 'Автомат' });
  await page.getByLabel('Привод').selectOption({ label: 'Передний' });
  await page.getByLabel('Город').selectOption({ label: 'Ташкент' });
  await page.getByLabel('Цена, UZS').fill('95000000');
  await page.getByRole('button', { name: 'Далее' }).click();

  // Шаг 2 — фото: загрузка + мок CV-детекции блюра номера/VIN.
  await page.setInputFiles('input[type="file"]', FIXTURE_PHOTO);
  await expect(page.getByText('Номер и VIN замазаны')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Далее' }).click();

  // Шаг 3 — оценка цены: авто-запрос при входе на шаг, ждём терминальное
  // состояние (рекомендованный диапазон видит только продавец — FR-05).
  await expect(page.getByText(/Рекомендованный диапазон:/)).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Далее' }).click();

  // Шаг 4 — проверка и публикация.
  await expect(page.getByRole('heading', { name: 'Характеристики' })).toBeVisible();
  await page.getByRole('button', { name: 'Опубликовать' }).click();

  await expect(page.getByText('Объявление отправлено на модерацию')).toBeVisible({
    timeout: 10_000,
  });
});

test('мастер: шаг фото не пропускается без фото (FR-02 AC)', async ({ page }) => {
  await gotoHydrated(page, '/ru/sell/new');
  await proveHydrated(page, { role: 'button', name: 'Далее' }, 'Укажите марку');

  await page.getByLabel('Марка').fill('Chevrolet');
  await page.getByLabel('Модель').fill('Nexia 3');
  await page.getByLabel('Год выпуска').fill('2021');
  await page.getByLabel('Пробег, км').fill('30000');
  await page.getByLabel('Состояние').selectOption({ label: 'Хорошее' });
  await page.getByLabel('Коробка передач').selectOption({ label: 'Механика' });
  await page.getByLabel('Привод').selectOption({ label: 'Передний' });
  await page.getByLabel('Город').selectOption({ label: 'Ташкент' });
  await page.getByLabel('Цена, UZS').fill('100000000');
  await page.getByRole('button', { name: 'Далее' }).click();

  await page.getByRole('button', { name: 'Далее' }).click();
  await expect(page.getByText('Добавьте хотя бы одно фото')).toBeVisible();
});
