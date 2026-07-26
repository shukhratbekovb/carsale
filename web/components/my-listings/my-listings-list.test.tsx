import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@/src/test/utils';
import type { SellerListing } from '@/types/my-listing';
import { MyListingsList } from './my-listings-list';

const api = vi.hoisted(() => ({ fetchMyListings: vi.fn() }));
vi.mock('@/lib/listings/my-listings-api', () => ({ fetchMyListings: api.fetchMyListings }));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: React.ComponentProps<'a'>) => (
    <a href={typeof href === 'string' ? href : undefined} {...props}>
      {children}
    </a>
  ),
}));

const listing = (over: Partial<SellerListing> = {}): SellerListing => ({
  id: 'l1',
  status: 'PUBLISHED',
  make: 'Chevrolet',
  model: 'Cobalt',
  year: 2021,
  mileageKm: 15000,
  priceUzs: 165000000,
  city: 'Tashkent',
  dealRatingLabel: 'GREAT_DEAL',
  mileageFlag: false,
  fraudFlag: false,
  createdAt: '2026-07-25T00:00:00.000Z',
  updatedAt: '2026-07-25T00:00:00.000Z',
  ...over,
});

beforeEach(() => api.fetchMyListings.mockReset());

test('renders the seller listings with status + deal rating; published links to the card', async () => {
  api.fetchMyListings.mockResolvedValue([listing()]);
  render(<MyListingsList />);

  expect(await screen.findByText('Chevrolet Cobalt, 2021')).toBeInTheDocument();
  expect(screen.getByText('Опубликовано')).toBeInTheDocument();
  expect(screen.getByText('Отличная сделка')).toBeInTheDocument();
  expect(screen.getByRole('link')).toHaveAttribute('href', '/catalog/l1');
});

test('non-published listing is shown without a link', async () => {
  api.fetchMyListings.mockResolvedValue([listing({ status: 'PENDING_MODERATION', dealRatingLabel: null })]);
  render(<MyListingsList />);

  expect(await screen.findByText('На модерации')).toBeInTheDocument();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});

test('empty result shows the empty state with a create link', async () => {
  api.fetchMyListings.mockResolvedValue([]);
  render(<MyListingsList />);

  expect(await screen.findByText('У вас пока нет объявлений')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Разместить объявление' })).toHaveAttribute('href', '/sell/new');
});

test('error shows a retry that refetches', async () => {
  api.fetchMyListings.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce([]);
  render(<MyListingsList />);

  expect(await screen.findByText('Не удалось загрузить объявления.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));

  await waitFor(() => expect(screen.getByText('У вас пока нет объявлений')).toBeInTheDocument());
  expect(api.fetchMyListings).toHaveBeenCalledTimes(2);
});
