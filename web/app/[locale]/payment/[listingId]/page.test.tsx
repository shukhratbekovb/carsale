import { render, screen } from '@/src/test/utils';
import PaymentPage from './page';
import { mockListings } from '@/lib/mock/listings';

const nav = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  searchParams: new URLSearchParams(),
}));

// PaymentPage renders GatewaySelect, a client component reading useSearchParams
// / useRouter — mock the same way gateway-select.test.tsx does. next/navigation
// is partially mocked so notFound() (used directly by PaymentPage) still works.
vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<typeof import('next/navigation')>('next/navigation');
  return {
    ...actual,
    useSearchParams: () => nav.searchParams,
  };
});

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
}));

const KNOWN_LISTING = mockListings.find((listing) => listing.id === '1')!;

beforeEach(() => {
  nav.push.mockClear();
  nav.replace.mockClear();
  nav.searchParams = new URLSearchParams();
});

test('renders the payment page title and gateway select for a known listing', () => {
  render(<PaymentPage params={{ listingId: KNOWN_LISTING.id }} />);

  expect(screen.getByRole('heading', { name: 'Оплата' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Click' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Payme' })).toBeInTheDocument();
});

test('throws Next.js not-found for an unknown listing id', () => {
  let thrown: unknown;
  try {
    render(<PaymentPage params={{ listingId: 'does-not-exist' }} />);
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toBeInstanceOf(Error);
  expect((thrown as Error & { digest?: string }).digest).toBe('NEXT_NOT_FOUND');
});
