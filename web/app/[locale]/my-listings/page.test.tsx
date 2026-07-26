import { render, screen } from '@/src/test/utils';
import MyListingsPage from './page';

// Страница session-aware (§5): RequireAuth редиректит гостя; авторизованный видит
// заголовок + MyListingsList (его состояния — в отдельном тесте, здесь стаб).
const nav = vi.hoisted(() => ({ replace: vi.fn(), pathname: '/my-listings' }));
const session = vi.hoisted(() => ({ status: 'authenticated' as 'authenticated' | 'anonymous' | 'loading' }));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, push: vi.fn() }),
  usePathname: () => nav.pathname,
}));

vi.mock('@/lib/auth/session', () => ({
  useSession: () => ({ status: session.status }),
}));

vi.mock('@/components/my-listings/my-listings-list', () => ({
  MyListingsList: () => <div data-testid="my-listings-list" />,
}));

beforeEach(() => {
  nav.replace.mockClear();
  session.status = 'authenticated';
});

test('authenticated: renders the title and the listings list', () => {
  render(<MyListingsPage />);

  expect(screen.getByRole('heading', { name: 'Мои объявления' })).toBeInTheDocument();
  expect(screen.getByTestId('my-listings-list')).toBeInTheDocument();
  expect(nav.replace).not.toHaveBeenCalled();
});

test('anonymous: redirects to login with return and hides content', () => {
  session.status = 'anonymous';
  render(<MyListingsPage />);

  expect(nav.replace).toHaveBeenCalledWith('/auth/login?return=%2Fmy-listings');
  expect(screen.queryByRole('heading', { name: 'Мои объявления' })).not.toBeInTheDocument();
  expect(screen.queryByTestId('my-listings-list')).not.toBeInTheDocument();
});

test('loading: shows neither content nor a redirect yet', () => {
  session.status = 'loading';
  render(<MyListingsPage />);

  expect(nav.replace).not.toHaveBeenCalled();
  expect(screen.queryByTestId('my-listings-list')).not.toBeInTheDocument();
});
