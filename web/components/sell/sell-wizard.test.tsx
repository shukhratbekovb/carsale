import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@/src/test/utils';
import { SellWizard } from './sell-wizard';

const nav = vi.hoisted(() => ({ push: vi.fn() }));
const blur = vi.hoisted(() => ({ mockDetectBlurRegions: vi.fn() }));
const price = vi.hoisted(() => ({ mockEstimatePrice: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push }),
}));

vi.mock('@/lib/mock/photo-blur', () => ({
  mockDetectBlurRegions: blur.mockDetectBlurRegions,
}));

vi.mock('@/lib/mock/price-estimate', () => ({
  mockEstimatePrice: price.mockEstimatePrice,
}));

const FILE = new File(['fake-image-bytes'], 'car.jpg', { type: 'image/jpeg' });

async function fillVehicleDetails() {
  await userEvent.type(screen.getByLabelText('Марка'), 'Chevrolet');
  await userEvent.type(screen.getByLabelText('Модель'), 'Cobalt');
  await userEvent.type(screen.getByLabelText('Год выпуска'), '2019');
  await userEvent.type(screen.getByLabelText('Пробег, км'), '78000');
  await userEvent.selectOptions(screen.getByLabelText('Состояние'), 'GOOD');
  await userEvent.selectOptions(screen.getByLabelText('Коробка передач'), 'AUTOMATIC');
  await userEvent.selectOptions(screen.getByLabelText('Привод'), 'FWD');
  await userEvent.selectOptions(screen.getByLabelText('Город'), 'Ташкент');
  await userEvent.type(screen.getByLabelText('Цена, UZS'), '95000000');
  await userEvent.click(screen.getByRole('button', { name: 'Далее' }));
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  URL.revokeObjectURL = vi.fn();
  nav.push.mockClear();
  blur.mockDetectBlurRegions.mockReset();
  blur.mockDetectBlurRegions.mockResolvedValue([{ x: 0.35, y: 0.72, width: 0.3, height: 0.1 }]);
  price.mockEstimatePrice.mockReset();
  price.mockEstimatePrice.mockResolvedValue({
    label: 'OVERPRICED',
    recommendedMin: 43_290_000,
    recommendedMax: 52_910_000,
  });
});

test('starts on the vehicle details step with the step progress indicator', () => {
  render(<SellWizard />);

  expect(screen.getByText('Характеристики')).toBeInTheDocument();
  expect(screen.getByText('Фотографии')).toBeInTheDocument();
  expect(screen.getByText('Оценка цены')).toBeInTheDocument();
  expect(screen.getByText('Проверка и публикация')).toBeInTheDocument();
  expect(screen.getByLabelText('Марка')).toBeInTheDocument();
});

test('blocks advancing past an incomplete vehicle details step', async () => {
  render(<SellWizard />);

  await userEvent.click(screen.getByRole('button', { name: 'Далее' }));

  // Всё ещё на первом шаге — обязательные поля не заполнены.
  expect(screen.getByLabelText('Марка')).toBeInTheDocument();
});

test('completes the full wizard happy path through to the moderation confirmation', async () => {
  render(<SellWizard />);

  await fillVehicleDetails();

  // Шаг фото
  expect(await screen.findByLabelText('Добавить фото')).toBeInTheDocument();
  await userEvent.upload(screen.getByLabelText('Добавить фото'), FILE);
  await screen.findByText('Номер и VIN замазаны');
  await userEvent.click(screen.getByRole('button', { name: 'Далее' }));

  // Шаг оценки цены — автозапрос при входе, показывает результат
  await waitFor(() => expect(price.mockEstimatePrice).toHaveBeenCalledTimes(1));
  expect(await screen.findByText('Завышенная цена')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Далее' }));

  // Шаг проверки — сводка + публикация
  expect(await screen.findByText(/Chevrolet Cobalt, 2019/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Опубликовать' }));

  expect(await screen.findByText('Объявление отправлено на модерацию')).toBeInTheDocument();
});

test('going back to vehicle details preserves previously entered values', async () => {
  render(<SellWizard />);

  await fillVehicleDetails();
  await screen.findByLabelText('Добавить фото');

  await userEvent.click(screen.getByRole('button', { name: 'Назад' }));

  expect(screen.getByLabelText('Марка')).toHaveValue('Chevrolet');
  expect(screen.getByLabelText('Цена, UZS')).toHaveValue(95000000);
});

test('navigates to /catalog from the moderation confirmation screen', async () => {
  render(<SellWizard />);

  await fillVehicleDetails();
  await screen.findByLabelText('Добавить фото');
  await userEvent.upload(screen.getByLabelText('Добавить фото'), FILE);
  await screen.findByText('Номер и VIN замазаны');
  await userEvent.click(screen.getByRole('button', { name: 'Далее' }));

  await screen.findByText('Завышенная цена');
  await userEvent.click(screen.getByRole('button', { name: 'Далее' }));

  await screen.findByText(/Chevrolet Cobalt, 2019/);
  await userEvent.click(screen.getByRole('button', { name: 'Опубликовать' }));

  await screen.findByText('Объявление отправлено на модерацию');
  await userEvent.click(screen.getByRole('button', { name: 'В каталог' }));

  expect(nav.push).toHaveBeenCalledWith('/catalog');
});
