import { describe, expect, test } from 'vitest';
import { getColorDisplayName } from './listing-translations';

describe('getColorDisplayName', () => {
  test('returns the Russian color name as-is for the ru locale', () => {
    expect(getColorDisplayName('Белый', 'ru')).toBe('Белый');
  });

  test('returns the Uzbek color name for the uz locale', () => {
    expect(getColorDisplayName('Белый', 'uz')).toBe('Oq');
    expect(getColorDisplayName('Чёрный', 'uz')).toBe('Qora');
  });

  test('falls back to the input string for an unknown color on the uz locale', () => {
    expect(getColorDisplayName('Фиолетовый', 'uz')).toBe('Фиолетовый');
  });
});
