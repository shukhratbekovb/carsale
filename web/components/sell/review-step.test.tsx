import userEvent from '@testing-library/user-event';
import { render, screen } from '@/src/test/utils';
import type { ListingDraft } from '@/types/sell';
import { ReviewStep } from './review-step';

const DRAFT: ListingDraft = {
  vehicle: {
    make: 'Chevrolet',
    model: 'Cobalt',
    year: 2019,
    mileageKm: 78000,
    condition: 'GOOD',
    transmission: 'AUTOMATIC',
    driveType: 'FWD',
    city: 'Ташкент',
    priceUzs: 95_000_000,
  },
  description: undefined,
  photos: [{ id: 'p1', status: 'BLUR_DONE', previewUrl: 'blob:mock', detectedRegions: [] }],
  priceEstimate: { status: 'LOADED', label: 'OVERPRICED' },
};

test('renders a read-only summary of the collected draft', () => {
  render(<ReviewStep draft={DRAFT} onComplete={vi.fn()} onSubmit={vi.fn()} />);

  expect(screen.getByText(/Chevrolet Cobalt, 2019/)).toBeInTheDocument();
  expect(screen.getByText('95 000 000 UZS')).toBeInTheDocument();
  expect(screen.getByText('Фото (1)')).toBeInTheDocument();
  expect(screen.getByText('Завышенная цена')).toBeInTheDocument();
});

test('calls onComplete with the description and onSubmit on publish', async () => {
  const onComplete = vi.fn();
  const onSubmit = vi.fn();
  render(<ReviewStep draft={DRAFT} onComplete={onComplete} onSubmit={onSubmit} />);

  await userEvent.type(screen.getByLabelText('Описание'), 'Отличная машина');
  await userEvent.click(screen.getByRole('button', { name: 'Опубликовать' }));

  expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ description: 'Отличная машина' }));
  expect(onSubmit).toHaveBeenCalledTimes(1);
});

test('allows publishing without a description (optional field)', async () => {
  const onComplete = vi.fn();
  const onSubmit = vi.fn();
  render(<ReviewStep draft={DRAFT} onComplete={onComplete} onSubmit={onSubmit} />);

  await userEvent.click(screen.getByRole('button', { name: 'Опубликовать' }));

  expect(onComplete).toHaveBeenCalled();
  expect(onSubmit).toHaveBeenCalledTimes(1);
});
