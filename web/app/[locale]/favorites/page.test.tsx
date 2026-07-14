import { render, screen } from '@/src/test/utils';
import FavoritesPage from './page';
import { mockListings } from '@/lib/mock/listings';

const FAVORITES_STORAGE_KEY = 'carsale:favorites';

// id '1' (Chevrolet Cobalt) and id '6' (Toyota Camry) — plain, description-bearing
// fixtures with distinct make/model, good for asserting two cards render side by side.
const listingA = mockListings.find((listing) => listing.id === '1')!;
const listingB = mockListings.find((listing) => listing.id === '6')!;

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

test('renders the empty state with a link to the catalog when there are no favorites', () => {
  render(<FavoritesPage />);

  expect(screen.getByRole('heading', { name: 'Избранное' })).toBeInTheDocument();
  expect(screen.getByText('0 объявлений')).toBeInTheDocument();
  expect(screen.getByText('В избранном пока пусто')).toBeInTheDocument();
  expect(
    screen.getByText('Нажмите на сердечко на карточке объявления, чтобы сохранить его здесь.')
  ).toBeInTheDocument();

  // Тестовый провайдер даёт locale="ru" (не дефолтная) — i18n-Link добавляет префикс.
  expect(screen.getByRole('link', { name: 'Смотреть каталог' })).toHaveAttribute('href', '/ru/catalog');
});

test('renders a ListingCard for each favorited listing with a matching count', () => {
  localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([listingA.id, listingB.id]));

  render(<FavoritesPage />);

  expect(screen.getByText(`${listingA.make} ${listingA.model}, ${listingA.year}`)).toBeInTheDocument();
  expect(screen.getByText(`${listingB.make} ${listingB.model}, ${listingB.year}`)).toBeInTheDocument();
  expect(screen.getByText('2 объявления')).toBeInTheDocument();
  expect(screen.queryByText('В избранном пока пусто')).not.toBeInTheDocument();
});

test('ignores favorite ids that no longer match any mock listing', () => {
  localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([listingA.id, 'does-not-exist']));

  render(<FavoritesPage />);

  expect(screen.getByText(`${listingA.make} ${listingA.model}, ${listingA.year}`)).toBeInTheDocument();
  expect(screen.getByText('1 объявление')).toBeInTheDocument();
});
