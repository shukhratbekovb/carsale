import { render, screen } from '@/src/test/utils';
import { ListingDetail } from '@/components/catalog/listing-detail';
import { mockListings } from '@/lib/mock/listings';
import ListingPage from './page';

// MessageSellerButton (FE-5) calls useRouter() from @/i18n/navigation, which
// needs a mounted Next.js App Router — not present under plain RTL render.
vi.mock('@/i18n/navigation', async () => {
  const actual = await vi.importActual<typeof import('@/i18n/navigation')>('@/i18n/navigation');
  return { ...actual, useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) };
});

// Card page фетчит объявление из Core (§5); в тесте not-found подменяем фетчер.
const api = vi.hoisted(() => ({ fetchListing: vi.fn() }));
vi.mock('@/lib/catalog/api', () => ({ fetchListing: api.fetchListing }));

// Listing #4 has mileageFlag: true with a reason, dealRating FAIR_PRICE (not
// UNAVAILABLE) and sellerVerified: true — exercises all FR-07 "not lazy" badges
// on the detail view in one fixture (frontend-plan.md §6/§8).
const flaggedListing = mockListings.find((listing) => listing.id === '4')!;

test('ListingDetail renders make/model/year, price, deal rating and mileage flag synchronously', () => {
  render(<ListingDetail listing={flaggedListing} />);

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

test('page throws Next.js not-found when Core has no such listing', async () => {
  api.fetchListing.mockResolvedValue(null);

  await expect(
    ListingPage({ params: { id: 'does-not-exist', locale: 'ru' } })
  ).rejects.toMatchObject({ digest: 'NEXT_NOT_FOUND' });
});
