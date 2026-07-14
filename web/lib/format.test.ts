import { describe, expect, test } from 'vitest';
import { formatMileage, formatUzs } from './format';

// Регрессия: найдено живой проверкой /payment — Intl.NumberFormat('uz') даёт
// разные результаты на сервере (Node ICU) и в браузере (CSR), что рвёт
// гидратацию. formatUzs/formatMileage для uz обязаны быть детерминированы
// независимо от рантайма — этот тест фиксирует то, что должно совпадать
// с server-side выводом на любой машине, где он гоняется.
//
// Intl.NumberFormat('ru-RU') группирует через U+00A0 (неразрывный пробел),
// не через обычный ASCII-пробел — используем его же в ожидаемых строках,
// иначе литералы визуально совпадают, но тест ложно падает.
const NBSP = ' ';

describe('formatUzs', () => {
  test('groups thousands with a space and appends the ru suffix for ru locale', () => {
    expect(formatUzs(45_000, 'ru')).toBe(`45${NBSP}000 сум`);
    expect(formatUzs(1_000_000, 'ru')).toBe(`1${NBSP}000${NBSP}000 сум`);
  });

  test('groups thousands with a space and appends the uz suffix for uz locale', () => {
    expect(formatUzs(45_000, 'uz')).toBe('45 000 soʻm');
    expect(formatUzs(1_000_000, 'uz')).toBe('1 000 000 soʻm');
  });

  test('falls back to ru formatting for an unknown locale', () => {
    expect(formatUzs(45_000, 'en')).toBe(`45${NBSP}000 сум`);
  });

  test('handles values under 1000 without a separator', () => {
    expect(formatUzs(500, 'uz')).toBe('500 soʻm');
  });
});

describe('formatMileage', () => {
  test('groups thousands and appends the locale-specific unit', () => {
    expect(formatMileage(78_000, 'ru')).toBe(`78${NBSP}000 км`);
    expect(formatMileage(78_000, 'uz')).toBe('78 000 km');
  });
});
