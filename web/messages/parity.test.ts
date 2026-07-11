import { describe, expect, test } from 'vitest';
import ruMessages from './ru.json';
import uzMessages from './uz.json';

// Гейт «0 непереведённых строк» (frontend-plan.md §7, NFR-28) на уровне словарей:
// ключ, добавленный только в одну локаль, падает здесь — а не молча рендерится
// сырым message-id (или MISSING_MESSAGE) на проде второй локали.

type Messages = Record<string, unknown>;

function flattenKeys(node: Messages, prefix = ''): string[] {
  return Object.entries(node).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object') {
      return flattenKeys(value as Messages, path);
    }
    return [path];
  });
}

function messageAt(node: Messages, path: string): string {
  const value = path.split('.').reduce<unknown>((acc, key) => (acc as Messages)[key], node);
  return value as string;
}

// Имена ICU-аргументов: {phone}, {count, plural, ...}, {min, number}.
// Вложенные ветки plural вида {# объявлений} не матчатся — после '{' не \w.
function icuArguments(message: string): string[] {
  return [...message.matchAll(/\{(\w+)/g)].map((match) => match[1]).sort();
}

const ruKeys = flattenKeys(ruMessages).sort();
const uzKeys = flattenKeys(uzMessages).sort();

describe('messages/{uz,ru}.json parity', () => {
  test('both locales define exactly the same key set', () => {
    expect(uzKeys).toEqual(ruKeys);
  });

  test('no message is an empty string', () => {
    for (const key of ruKeys) {
      expect(messageAt(ruMessages, key), `ru:${key}`).not.toBe('');
    }
    for (const key of uzKeys) {
      expect(messageAt(uzMessages, key), `uz:${key}`).not.toBe('');
    }
  });

  test('ICU arguments match between locales for every key', () => {
    for (const key of ruKeys) {
      const ruArgs = icuArguments(messageAt(ruMessages, key));
      const uzArgs = icuArguments(messageAt(uzMessages, key));
      expect(uzArgs, `ICU args diverge at "${key}"`).toEqual(ruArgs);
    }
  });
});
