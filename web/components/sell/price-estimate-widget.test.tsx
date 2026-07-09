import userEvent from '@testing-library/user-event';
import { render, screen } from '@/src/test/utils';
import type { PriceEstimateState } from '@/types/sell';
import { PriceEstimateWidget } from './price-estimate-widget';

const priceEstimate = vi.hoisted(() => ({
  mockEstimatePrice: vi.fn(),
}));

vi.mock('@/lib/mock/price-estimate', () => ({
  mockEstimatePrice: priceEstimate.mockEstimatePrice,
}));

const VEHICLE = { make: 'Chevrolet', model: 'Cobalt', year: 2019, mileageKm: 78000, city: 'Ташкент', priceUzs: 95_000_000 };

beforeEach(() => {
  priceEstimate.mockEstimatePrice.mockReset();
});

function renderWidget(state: PriceEstimateState, overrides: Partial<Parameters<typeof PriceEstimateWidget>[0]> = {}) {
  return render(
    <PriceEstimateWidget
      priceEstimate={state}
      vehicle={VEHICLE}
      onLoading={vi.fn()}
      onLoaded={vi.fn()}
      onFailed={vi.fn()}
      onComplete={vi.fn()}
      {...overrides}
    />
  );
}

test('auto-triggers an estimate request when idle', async () => {
  priceEstimate.mockEstimatePrice.mockResolvedValue({ label: 'FAIR_PRICE', recommendedMin: 1, recommendedMax: 2 });
  const onLoading = vi.fn();
  renderWidget({ status: 'IDLE' }, { onLoading });

  expect(onLoading).toHaveBeenCalledTimes(1);
  expect(priceEstimate.mockEstimatePrice).toHaveBeenCalledWith(VEHICLE);
});

test('renders the deal rating badge and recommended range when loaded', () => {
  renderWidget({
    status: 'LOADED',
    label: 'GREAT_DEAL',
    recommendedMin: 40_000_000,
    recommendedMax: 48_000_000,
  });

  expect(screen.getByText('Отличная сделка')).toBeInTheDocument();
  expect(screen.getByText(/40 000 000/)).toBeInTheDocument();
});

test('renders the UNAVAILABLE badge (not an error) when the model has no verdict', () => {
  renderWidget({ status: 'LOADED', label: 'UNAVAILABLE' });

  expect(screen.getByText('Оценка недоступна')).toBeInTheDocument();
  expect(screen.queryByText('Не удалось получить оценку цены')).not.toBeInTheDocument();
});

test('shows a retry button on FAILED and re-requests the estimate on click', async () => {
  priceEstimate.mockEstimatePrice.mockResolvedValue({ label: 'FAIR_PRICE' });
  const onLoading = vi.fn();
  renderWidget({ status: 'FAILED' }, { onLoading });

  expect(screen.getByText('Не удалось получить оценку цены')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));

  expect(onLoading).toHaveBeenCalledTimes(1);
  expect(priceEstimate.mockEstimatePrice).toHaveBeenCalledWith(VEHICLE);
});

test('disables the Next button while loading', () => {
  renderWidget({ status: 'LOADING' });
  expect(screen.getByRole('button', { name: 'Далее' })).toBeDisabled();
});

test('calls onComplete when Next is clicked', async () => {
  const onComplete = vi.fn();
  renderWidget({ status: 'LOADED', label: 'FAIR_PRICE' }, { onComplete });

  await userEvent.click(screen.getByRole('button', { name: 'Далее' }));

  expect(onComplete).toHaveBeenCalledTimes(1);
});
