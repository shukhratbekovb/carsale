import userEvent from '@testing-library/user-event';
import type { MockInstance } from 'vitest';
import { render, screen, waitFor } from '@/src/test/utils';
import type { DataExportPayload } from '@/types/gdpr';
import { GdprSection } from './gdpr-section';

// Секция — UI поверх lib/mock/gdpr: мокаем сетевые заглушки, чтобы не
// тянуть их latency (fake timers) в компонентный тест; сами моки покрыты
// в lib/mock/gdpr.test.ts.
const gdpr = vi.hoisted(() => ({
  mockExportUserData: vi.fn(),
  mockRequestAccountDeletion: vi.fn(),
}));

vi.mock('@/lib/mock/gdpr', () => gdpr);

const EXPORT_PAYLOAD: DataExportPayload = {
  exportedAt: '2026-07-16T09:00:00.000Z',
  device: true,
  consents: { personalData: true, marketing: false, acceptedAt: '2026-07-10T09:00:00.000Z' },
  favorites: ['1'],
  notificationPreferences: null,
  city: null,
};

// jsdom не реализует URL.createObjectURL/revokeObjectURL — подменяем на
// vi.fn, чтобы флоу скачивания вообще мог выполниться и был проверяем.
const createObjectURL = vi.fn((_blob: Blob) => 'blob:carsale-export');
const revokeObjectURL = vi.fn();

// Клик по временной ссылке в jsdom привёл бы к «Not implemented: navigation» —
// глушим click якоря и заодно проверяем, что скачивание было запущено.
let anchorClick: MockInstance;

beforeEach(() => {
  localStorage.clear();
  gdpr.mockExportUserData.mockReset().mockResolvedValue(EXPORT_PAYLOAD);
  gdpr.mockRequestAccountDeletion.mockReset().mockResolvedValue({
    requestedAt: '2026-07-16T09:00:00.000Z',
    dueBy: '2026-08-06T09:00:00.000Z',
  });
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  Object.assign(URL, { createObjectURL, revokeObjectURL });
  anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

afterEach(() => {
  anchorClick.mockRestore();
});

test('export button downloads the payload as a JSON blob and revokes the object URL', async () => {
  render(<GdprSection />);

  await userEvent.click(screen.getByRole('button', { name: 'Скачать мои данные' }));

  await waitFor(() => expect(gdpr.mockExportUserData).toHaveBeenCalledTimes(1));
  // Blob → object-URL → клик по ссылке → немедленное освобождение URL.
  expect(createObjectURL).toHaveBeenCalledTimes(1);
  expect(createObjectURL.mock.calls[0][0]).toBeInstanceOf(Blob);
  expect(anchorClick).toHaveBeenCalledTimes(1);
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:carsale-export');
  // Кнопка вернулась из состояния «Готовим файл...».
  expect(await screen.findByRole('button', { name: 'Скачать мои данные' })).toBeEnabled();
});

test('deletion flow: button opens an inline confirmation with the 15-business-days note', async () => {
  render(<GdprSection />);

  await userEvent.click(screen.getByRole('button', { name: 'Удалить аккаунт' }));

  expect(
    screen.getByText(
      'Удаление аккаунта необратимо: объявления, переписки, избранное и настройки будут удалены.'
    )
  ).toBeInTheDocument();
  expect(
    screen.getByText('Запрос будет обработан в срок не более 15 рабочих дней (ЗРУ-547, ст. 19–22).')
  ).toBeInTheDocument();
  // До подтверждения запрос не отправляется.
  expect(gdpr.mockRequestAccountDeletion).not.toHaveBeenCalled();
});

test('confirming the deletion calls the mock and shows the receipt with both dates', async () => {
  render(<GdprSection />);

  await userEvent.click(screen.getByRole('button', { name: 'Удалить аккаунт' }));
  await userEvent.click(screen.getByRole('button', { name: 'Подтвердить удаление' }));

  await waitFor(() => expect(gdpr.mockRequestAccountDeletion).toHaveBeenCalledTimes(1));
  // Квитанция со сроками в формате ДД.ММ.ГГГГ (formatDateDdMmYyyy).
  expect(
    await screen.findByRole('status')
  ).toHaveTextContent('Запрос принят 16.07.2026 и будет обработан до 06.08.2026.');
  // Подтверждение свёрнуто, повторное удаление недоступно.
  expect(screen.queryByRole('button', { name: 'Подтвердить удаление' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Удалить аккаунт' })).not.toBeInTheDocument();
});

test('cancelling collapses the confirmation without calling the deletion mock', async () => {
  render(<GdprSection />);

  await userEvent.click(screen.getByRole('button', { name: 'Удалить аккаунт' }));
  await userEvent.click(screen.getByRole('button', { name: 'Отмена' }));

  expect(gdpr.mockRequestAccountDeletion).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Подтвердить удаление' })).not.toBeInTheDocument();
  // Исходная кнопка вернулась — флоу можно начать заново.
  expect(screen.getByRole('button', { name: 'Удалить аккаунт' })).toBeInTheDocument();
});
