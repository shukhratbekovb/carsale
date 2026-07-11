import { render, screen } from '@/src/test/utils';
import ListingPage from './page';
import { mockListings } from '@/lib/mock/listings';

// Listing #4 has mileageFlag: true with a reason, dealRating FAIR_PRICE (not
// UNAVAILABLE) and sellerVerified: true — exercises all FR-07 "not lazy" badges
// on the detail page in one fixture (frontend-plan.md §6/§8).
const flaggedListing = mockListings.find((listing) => listing.id === '4')!;

test('renders make/model/year, formatted price, deal rating and mileage flag synchronously', () => {
  render(<ListingPage params={{ id: flaggedListing.id }} />);

  expect(
    screen.getByRole('heading', {
      name: `${flaggedListing.make} ${flaggedListing.model}, ${flaggedListing.year}`,
    })
  ).toBeInTheDocument();
  expect(screen.getByText('62 000 000 сум')).toBeInTheDocument();

  // No act()/waitFor — these ML-derived flags must be present in the first render.
  expect(screen.getByText('Честная цена')).toBeInTheDocument();
  expect(screen.getByText('Пробег требует проверки')).toBeInTheDocument();
  expect(screen.getByText('Проверен')).toBeInTheDocument();
});

test('throws Next.js not-found for an unknown listing id', () => {
  let thrown: unknown;
  try {
    render(<ListingPage params={{ id: 'does-not-exist' }} />);
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toBeInstanceOf(Error);
  expect((thrown as Error & { digest?: string }).digest).toBe('NEXT_NOT_FOUND');
});
