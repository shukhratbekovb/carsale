import userEvent from '@testing-library/user-event';
import { fireEvent, render, screen } from '@/src/test/utils';
import { FavoriteButton } from './favorite-button';

// FavoriteButton теперь читает серверное избранное из FavoritesProvider (§5) —
// мокаем контекст, чтобы задавать состояние; редирект гостя идёт через
// window.location.assign (не router-хуки).
const fav = vi.hoisted(() => ({
  isAuthenticated: false,
  isFavorite: vi.fn(() => false),
  toggleFavorite: vi.fn(),
}));
vi.mock('@/lib/favorites/favorites-context', () => ({
  useFavorites: () => ({
    isAuthenticated: fav.isAuthenticated,
    isFavorite: fav.isFavorite,
    toggleFavorite: fav.toggleFavorite,
  }),
}));

const LISTING = '11111111-1111-1111-1111-111111111111';

// jsdom window.location не spy-абелен — подменяем минимальным стабом с полями,
// которые читает кнопка (pathname/search/assign).
let assignMock: ReturnType<typeof vi.fn>;
const realLocation = window.location;

beforeEach(() => {
  fav.isAuthenticated = false;
  fav.isFavorite.mockReturnValue(false);
  fav.toggleFavorite.mockClear();
  assignMock = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { pathname: '/ru/catalog/1', search: '', assign: assignMock },
  });
});

afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: realLocation });
});

test('renders unpressed with the "add" label when not favorited', () => {
  render(<FavoriteButton listingId={LISTING} />);
  expect(screen.getByRole('button', { name: 'Добавить в избранное' })).toHaveAttribute('aria-pressed', 'false');
});

test('authenticated + favorited → pressed "remove" label', () => {
  fav.isAuthenticated = true;
  fav.isFavorite.mockReturnValue(true);
  render(<FavoriteButton listingId={LISTING} />);
  expect(screen.getByRole('button', { name: 'Убрать из избранного' })).toHaveAttribute('aria-pressed', 'true');
});

test('authenticated click → toggleFavorite, no login redirect', async () => {
  fav.isAuthenticated = true;
  render(<FavoriteButton listingId={LISTING} />);
  await userEvent.click(screen.getByRole('button', { name: 'Добавить в избранное' }));
  expect(fav.toggleFavorite).toHaveBeenCalledWith(LISTING);
  expect(assignMock).not.toHaveBeenCalled();
});

test('guest click → redirect to login with return, no toggle', async () => {
  fav.isAuthenticated = false;
  render(<FavoriteButton listingId={LISTING} />);
  await userEvent.click(screen.getByRole('button', { name: 'Добавить в избранное' }));
  expect(fav.toggleFavorite).not.toHaveBeenCalled();
  expect(assignMock).toHaveBeenCalledWith(expect.stringContaining('/auth/login?return='));
});

test('prevents the click default so a wrapping <Link> does not navigate', () => {
  fav.isAuthenticated = true;
  render(<FavoriteButton listingId={LISTING} />);
  // fireEvent.click returns false when the handler called preventDefault
  const notPrevented = fireEvent.click(screen.getByRole('button', { name: 'Добавить в избранное' }));
  expect(notPrevented).toBe(false);
});
