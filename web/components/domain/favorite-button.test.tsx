import userEvent from '@testing-library/user-event';
import { fireEvent, render, screen } from '@/src/test/utils';
import { FavoriteButton } from './favorite-button';
import { mockListings } from '@/lib/mock/listings';

const listingId = mockListings[0].id;

// FavoriteButton persists via useFavorites -> useLocalStorage (real window.localStorage).
beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

test('renders unpressed with the "add" label when the listing is not favorited', () => {
  render(<FavoriteButton listingId={listingId} />);

  const button = screen.getByRole('button', { name: 'Добавить в избранное' });
  expect(button).toHaveAttribute('aria-pressed', 'false');
});

test('toggles aria-pressed and the label on click, back and forth', async () => {
  const user = userEvent.setup();
  render(<FavoriteButton listingId={listingId} />);

  await user.click(screen.getByRole('button', { name: 'Добавить в избранное' }));

  const pressedButton = screen.getByRole('button', { name: 'Убрать из избранного' });
  expect(pressedButton).toHaveAttribute('aria-pressed', 'true');

  await user.click(pressedButton);

  const unpressedButton = screen.getByRole('button', { name: 'Добавить в избранное' });
  expect(unpressedButton).toHaveAttribute('aria-pressed', 'false');
});

test('prevents the click default so a wrapping <Link> does not navigate', () => {
  render(<FavoriteButton listingId={listingId} />);

  // fireEvent.click returns false when the dispatched event's default action
  // was prevented — exactly the signal that a parent <Link>'s navigation was suppressed.
  const notCancelled = fireEvent.click(screen.getByRole('button'));

  expect(notCancelled).toBe(false);
});
