import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const session = vi.hoisted(() => ({ status: 'authenticated' as 'authenticated' | 'anonymous' | 'loading' }));
const api = vi.hoisted(() => ({
  fetchFavoriteIds: vi.fn(),
  addFavorite: vi.fn(),
  removeFavorite: vi.fn(),
}));

vi.mock('@/lib/auth/session', () => ({ useSession: () => ({ status: session.status }) }));
vi.mock('@/lib/favorites/favorites-api', () => api);

import { FavoritesProvider, useFavorites } from './favorites-context';

function Harness() {
  const { isAuthenticated, isFavorite, toggleFavorite } = useFavorites();
  return (
    <div>
      <span data-testid="auth">{String(isAuthenticated)}</span>
      <span data-testid="l1">{String(isFavorite('l1'))}</span>
      <span data-testid="l2">{String(isFavorite('l2'))}</span>
      <button onClick={() => toggleFavorite('l1')}>toggle-l1</button>
      <button onClick={() => toggleFavorite('l2')}>toggle-l2</button>
    </div>
  );
}

const renderProvider = () =>
  render(
    <FavoritesProvider>
      <Harness />
    </FavoritesProvider>,
  );

beforeEach(() => {
  session.status = 'authenticated';
  api.fetchFavoriteIds.mockReset().mockResolvedValue([]);
  api.addFavorite.mockReset().mockResolvedValue(undefined);
  api.removeFavorite.mockReset().mockResolvedValue(undefined);
});

afterEach(() => vi.clearAllMocks());

describe('FavoritesProvider (§5)', () => {
  test('authenticated: загружает набор id, isFavorite отражает его', async () => {
    api.fetchFavoriteIds.mockResolvedValue(['l1']);
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('l1')).toHaveTextContent('true'));
    expect(screen.getByTestId('l2')).toHaveTextContent('false');
  });

  test('guest: не грузит и не тоглит', async () => {
    session.status = 'anonymous';
    renderProvider();
    expect(screen.getByTestId('auth')).toHaveTextContent('false');
    await userEvent.click(screen.getByText('toggle-l2'));
    expect(api.fetchFavoriteIds).not.toHaveBeenCalled();
    expect(api.addFavorite).not.toHaveBeenCalled();
    expect(screen.getByTestId('l2')).toHaveTextContent('false');
  });

  test('toggle add: оптимистично + вызывает API', async () => {
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('true'));
    await userEvent.click(screen.getByText('toggle-l2'));
    expect(screen.getByTestId('l2')).toHaveTextContent('true');
    expect(api.addFavorite).toHaveBeenCalledWith('l2');
  });

  test('toggle remove: откат при сбое API', async () => {
    api.fetchFavoriteIds.mockResolvedValue(['l1']);
    api.removeFavorite.mockRejectedValue(new Error('boom'));
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('l1')).toHaveTextContent('true'));

    await userEvent.click(screen.getByText('toggle-l1'));
    // откат → снова true
    await waitFor(() => expect(screen.getByTestId('l1')).toHaveTextContent('true'));
    expect(api.removeFavorite).toHaveBeenCalledWith('l1');
  });
});
