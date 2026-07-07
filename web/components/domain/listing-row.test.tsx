import { render, screen } from '@/src/test/utils';
import { ListingRow } from './listing-row';
import { mockListings } from '@/lib/mock/listings';

// Same fixture rationale as listing-card.test.tsx: id '4' has mileageFlag: true
// with a reason and a non-UNAVAILABLE deal rating, so both FR-07 flags apply.
const flaggedListing = mockListings.find((listing) => listing.id === '4')!;

test('renders make/model/year, price and city in the initial render', () => {
  render(<ListingRow listing={flaggedListing} />);

  expect(screen.getByText(`${flaggedListing.make} ${flaggedListing.model}, ${flaggedListing.year}`)).toBeInTheDocument();
  expect(screen.getByText('62 000 000 сум')).toBeInTheDocument();
  expect(screen.getByText(/Ташкент/)).toBeInTheDocument();
});

test('renders the Deal Rating badge and mileage flag synchronously, not lazily', () => {
  render(<ListingRow listing={flaggedListing} />);

  // No act()/waitFor — these must be present in the very first render output.
  expect(screen.getByText('Честная цена')).toBeInTheDocument();
  expect(screen.getByText('Пробег требует проверки')).toBeInTheDocument();
});

test('renders the verified badge when the seller is verified', () => {
  render(<ListingRow listing={flaggedListing} />);
  expect(screen.getByText('Проверен')).toBeInTheDocument();
});

test('omits the mileage flag when the listing has no flag', () => {
  const unflaggedListing = mockListings.find((listing) => listing.id === '1')!;
  render(<ListingRow listing={unflaggedListing} />);

  expect(screen.getByText('Отличная сделка')).toBeInTheDocument();
  expect(screen.queryByText('Пробег требует проверки')).not.toBeInTheDocument();
});

test('links to the listing detail page', () => {
  render(<ListingRow listing={flaggedListing} />);
  const links = screen.getAllByRole('link', {
    name: new RegExp(`${flaggedListing.make} ${flaggedListing.model}`),
  });
  expect(links[0]).toHaveAttribute('href', `/catalog/${flaggedListing.id}`);
});
