import { render, screen } from '@/src/test/utils';
import { ListingCard } from './listing-card';
import { mockListings } from '@/lib/mock/listings';

// Listing #4 in the fixtures has mileageFlag: true with a reason, a non-UNAVAILABLE
// deal rating (FAIR_PRICE) and sellerVerified: true — an ideal fixture for asserting
// that ML-flags render together with the card, not lazily (FR-07, frontend-plan.md §6/§8).
const flaggedListing = mockListings.find((listing) => listing.id === '4')!;

test('renders make/model/year, price and city in the initial render', () => {
  render(<ListingCard listing={flaggedListing} />);

  expect(screen.getByText(`${flaggedListing.make} ${flaggedListing.model}, ${flaggedListing.year}`)).toBeInTheDocument();
  expect(screen.getByText('62 000 000 сум')).toBeInTheDocument();
  expect(screen.getByText(/Ташкент/)).toBeInTheDocument();
});

test('renders the Deal Rating badge and mileage flag synchronously, not lazily', () => {
  render(<ListingCard listing={flaggedListing} />);

  // No act()/waitFor — these must be present in the very first render output.
  expect(screen.getByText('Честная цена')).toBeInTheDocument();
  expect(screen.getByText('Пробег требует проверки')).toBeInTheDocument();
});

test('renders the verified badge when the seller is verified', () => {
  render(<ListingCard listing={flaggedListing} />);
  expect(screen.getByText('Проверен')).toBeInTheDocument();
});

test('omits the mileage flag when the listing has no flag', () => {
  const unflaggedListing = mockListings.find((listing) => listing.id === '1')!;
  render(<ListingCard listing={unflaggedListing} />);

  expect(screen.getByText('Отличная сделка')).toBeInTheDocument();
  expect(screen.queryByText('Пробег требует проверки')).not.toBeInTheDocument();
});

test('renders the cover photo with a meaningful alt when photoUrl is present', () => {
  render(<ListingCard listing={flaggedListing} />);

  expect(
    screen.getByAltText(`${flaggedListing.make} ${flaggedListing.model}, ${flaggedListing.year}`)
  ).toBeInTheDocument();
  expect(screen.queryByLabelText('Фото объявления недоступно')).not.toBeInTheDocument();
});

test('falls back to the photo placeholder when the listing has no photoUrl', () => {
  // Объявление без фото — легальное состояние (Listing.photoUrl опционален).
  const { photoUrl: _photoUrl, ...withoutPhoto } = flaggedListing;
  render(<ListingCard listing={withoutPhoto} />);

  expect(screen.getByLabelText('Фото объявления недоступно')).toBeInTheDocument();
});

test('links to the listing detail page', () => {
  render(<ListingCard listing={flaggedListing} />);
  const links = screen.getAllByRole('link');
  // Тестовый провайдер даёт locale="ru" (не дефолтная) — i18n-Link добавляет префикс.
  expect(links[0]).toHaveAttribute('href', `/ru/catalog/${flaggedListing.id}`);
});
