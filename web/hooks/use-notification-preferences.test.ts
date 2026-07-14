import { act, renderHook } from '@testing-library/react';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@/types/notification';
import { useNotificationPreferences } from './use-notification-preferences';

// useLocalStorage under the hood reads/writes real window.localStorage — clear
// it around every test so state doesn't leak between them (same pattern as
// hooks/use-favorites.test.ts).
beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

test('starts with all notification types enabled by default', () => {
  const { result } = renderHook(() => useNotificationPreferences());

  expect(result.current.preferences).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
});

test('setPreference disables a single type without touching the others', () => {
  const { result } = renderHook(() => useNotificationPreferences());

  act(() => {
    result.current.setPreference('PRICE_DROP', false);
  });

  expect(result.current.preferences).toEqual({
    NEW_MESSAGE: true,
    PRICE_DROP: false,
    LISTING_STATUS: true,
  });
});

test('setPreference can re-enable a previously disabled type', () => {
  const { result } = renderHook(() => useNotificationPreferences());

  act(() => {
    result.current.setPreference('LISTING_STATUS', false);
  });
  act(() => {
    result.current.setPreference('LISTING_STATUS', true);
  });

  expect(result.current.preferences).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
});

test('persists preferences across remounts via localStorage', () => {
  const first = renderHook(() => useNotificationPreferences());

  act(() => {
    first.result.current.setPreference('NEW_MESSAGE', false);
  });
  first.unmount();

  const second = renderHook(() => useNotificationPreferences());

  expect(second.result.current.preferences).toEqual({
    NEW_MESSAGE: false,
    PRICE_DROP: true,
    LISTING_STATUS: true,
  });
});
