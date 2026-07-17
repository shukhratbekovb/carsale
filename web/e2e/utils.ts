import type { Page } from '@playwright/test';

// Переход + ожидание гидратации React: взаимодействие с формой до гидратации
// теряет ввод — первый fill уходит в статический SSR-HTML, а гидратация
// перерисовывает controlled-инпут (RHF) его пустым defaultValue. Ловилось как
// стабильное падение в webkit и флак в chromium под нагрузкой полной матрицы:
// «Марка» пустая при заполненных остальных полях.
//
// networkidle сам по себе не гарантирует гидратацию (в dev она может начаться
// позже загрузки чанков), поэтому дополнительно ждём маркер hydrateRoot:
// React 18 вешает на контейнер (в App Router это document) внутренний ключ
// __reactContainer$... в момент старта гидратации, а к networkidle после
// этого дерево уже интерактивно.
export async function gotoHydrated(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForFunction(() =>
    Object.keys(document).some((key) => key.startsWith('__reactContainer'))
  );
  await page.waitForLoadState('networkidle');
}

// Маркер __reactContainer появляется в момент СТАРТА hydrateRoot, но обработчики
// событий привязываются позже (в webkit — заметно позже). Единственное надёжное
// доказательство завершения гидратации — видимый эффект клиентского обработчика.
// Кликаем триггер (обычно submit пустой формы) в retry-цикле, пока не появится
// эффект (обычно валидационная ошибка): до гидратации клик уходит в пустоту
// (или в native-submit с перезагрузкой — retry переживает и это), после — RHF
// рисует ошибку. Дальше с формой можно взаимодействовать без потерь ввода.
export async function proveHydrated(
  page: Page,
  trigger: Parameters<Page['locator']>[0] | { role: 'button'; name: string },
  effectText: string
): Promise<void> {
  const { expect } = await import('@playwright/test');
  const triggerLocator =
    typeof trigger === 'string'
      ? page.locator(trigger)
      : page.getByRole(trigger.role, { name: trigger.name });

  await expect(async () => {
    await triggerLocator.click();
    await expect(page.getByText(effectText).first()).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 20_000 });
}
