import { act, renderHook } from '@testing-library/react';
import { useFavorites } from './use-favorites';

// useLocalStorage under the hood reads/writes real window.localStorage — clear
// it around every test so state doesn't leak between them.
beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

test('starts with no favorites', () => {
  const { result } = renderHook(() => useFavorites());

  expect(result.current.favoriteIds).toEqual([]);
  expect(result.current.isFavorite('1')).toBe(false);
});

test('toggleFavorite adds an id that is not yet favorited', () => {
  const { result } = renderHook(() => useFavorites());

  act(() => {
    result.current.toggleFavorite('1');
  });

  expect(result.current.favoriteIds).toEqual(['1']);
  expect(result.current.isFavorite('1')).toBe(true);
});

test('toggleFavorite removes an id that is already favorited', () => {
  const { result } = renderHook(() => useFavorites());

  act(() => {
    result.current.toggleFavorite('1');
  });
  act(() => {
    result.current.toggleFavorite('1');
  });

  expect(result.current.favoriteIds).toEqual([]);
  expect(result.current.isFavorite('1')).toBe(false);
});

test('keeps other ids untouched when toggling one of several favorites', () => {
  const { result } = renderHook(() => useFavorites());

  act(() => {
    result.current.toggleFavorite('1');
  });
  act(() => {
    result.current.toggleFavorite('4');
  });
  act(() => {
    result.current.toggleFavorite('1');
  });

  expect(result.current.favoriteIds).toEqual(['4']);
  expect(result.current.isFavorite('1')).toBe(false);
  expect(result.current.isFavorite('4')).toBe(true);
});

test('persists favorites across remounts via localStorage', () => {
  const first = renderHook(() => useFavorites());

  act(() => {
    first.result.current.toggleFavorite('4');
  });
  first.unmount();

  const second = renderHook(() => useFavorites());

  expect(second.result.current.favoriteIds).toEqual(['4']);
  expect(second.result.current.isFavorite('4')).toBe(true);
});
