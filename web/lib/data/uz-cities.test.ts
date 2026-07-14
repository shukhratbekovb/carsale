import { describe, expect, test } from 'vitest';
import { getCityDisplayName, UZ_CITIES } from './uz-cities';

describe('getCityDisplayName', () => {
  test('returns the Russian name as-is for the ru locale', () => {
    expect(getCityDisplayName('Ташкент', 'ru')).toBe('Ташкент');
  });

  test('returns the Uzbek Latin name for the uz locale', () => {
    expect(getCityDisplayName('Ташкент', 'uz')).toBe('Toshkent');
  });

  test('every seeded city has a matching Uzbek translation', () => {
    for (const city of UZ_CITIES) {
      expect(getCityDisplayName(city.name, 'uz')).toBe(city.nameUz);
    }
  });

  test('falls back to the input string for an unknown city on the uz locale', () => {
    expect(getCityDisplayName('Неизвестный', 'uz')).toBe('Неизвестный');
  });

  test('falls back to the Russian name for a locale other than uz', () => {
    expect(getCityDisplayName('Ташкент', 'en')).toBe('Ташкент');
  });
});
