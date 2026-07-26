import { render, screen, waitFor } from '@/src/test/utils';
import { mockListings } from '@/lib/mock/listings';
import FavoritesPage from './page';

// Избранное серверное и auth-walled (§5): мокаем сессию (RequireAuth), локале-
// навигацию и клиент избранного.
const nav = vi.hoisted(() => ({ replace: vi.fn(), pathname: '/favorites' }));
const session = vi.hoisted(() => ({ status: 'authenticated' as 'authenticated' | 'anonymous' | 'loading' }));
const api = vi.hoisted(() => ({ fetchFavorites: vi.fn() }));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, push: vi.fn() }),
  usePathname: () => nav.pathname,
  Link: ({ href, children, ...props }: React.ComponentProps<'a'>) => (
    <a href={typeof href === 'string' ? href : undefined} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/lib/auth/session', () => ({ useSession: () => ({ status: session.status }) }));
vi.mock('@/lib/favorites/favorites-api', () => ({ fetchFavorites: api.fetchFavorites }));

const listingA = mockListings.find((l) => l.id === '1')!;
const listingB = mockListings.find((l) => l.id === '6')!;

beforeEach(() => {
  nav.replace.mockClear();
  session.status = 'authenticated';
  api.fetchFavorites.mockReset();
});

test('anonymous → redirects to login with a return to /favorites', () => {
  session.status = 'anonymous';
  api.fetchFavorites.mockResolvedValue([]);
  render(<FavoritesPage />);
  expect(nav.replace).toHaveBeenCalledWith('/auth/login?return=%2Ffavorites');
  expect(screen.queryByRole('heading', { name: 'Избранное' })).not.toBeInTheDocument();
});

test('authenticated: renders a card per favorite with a matching count', async () => {
  api.fetchFavorites.mockResolvedValue([listingA, listingB]);
  render(<FavoritesPage />);

  expect(await screen.findByText(`${listingA.make} ${listingA.model}, ${listingA.year}`)).toBeInTheDocument();
  expect(screen.getByText(`${listingB.make} ${listingB.model}, ${listingB.year}`)).toBeInTheDocument();
  expect(screen.getByText('2 объявления')).toBeInTheDocument();
});

test('authenticated + empty → empty state with a catalog link', async () => {
  api.fetchFavorites.mockResolvedValue([]);
  render(<FavoritesPage />);

  expect(await screen.findByText('В избранном пока пусто')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Смотреть каталог' })).toHaveAttribute('href', '/catalog');
});

test('authenticated + fetch error → loadError with retry', async () => {
  api.fetchFavorites.mockRejectedValue(new Error('boom'));
  render(<FavoritesPage />);

  expect(await screen.findByText('Не удалось загрузить избранное.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument();
});
