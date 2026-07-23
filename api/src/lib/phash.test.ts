import { describe, expect, it } from 'vitest';
import { findDuplicate, hammingDistance } from './phash.js';

describe('hammingDistance (BE-2.5/3.6)', () => {
  it('одинаковые хеши → 0', () => {
    expect(hammingDistance('ff00ff00ff00ff00', 'ff00ff00ff00ff00')).toBe(0);
  });

  it('один ниббл отличается на 4 бита (0 vs f) → 4', () => {
    expect(hammingDistance('0000000000000000', '000000000000000f')).toBe(4);
  });

  it('несколько бит', () => {
    // 0x1 (0001) vs 0x2 (0010) = 2 бита; + 0x0 vs 0x8 (1000) = 1 бит → 3
    expect(hammingDistance('1000000000000000', '2000000000000008')).toBe(3);
  });

  it('разная длина → бесконечно далеко', () => {
    expect(hammingDistance('ff', 'ffff')).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('битый hex → бесконечно далеко', () => {
    expect(hammingDistance('zzzz', '0000')).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe('findDuplicate', () => {
  const candidates = [
    { listingId: 'A', phash: 'ffffffffffffffff' },
    { listingId: 'B', phash: '0000000000000000' },
  ];

  it('находит близкий (в пределах порога) → listingId', () => {
    // отличие от B на 4 бита, порог 8 → дубль B
    expect(findDuplicate(['000000000000000f'], candidates, 8)).toBe('B');
  });

  it('нет совпадений в пределах порога → null', () => {
    expect(findDuplicate(['0f0f0f0f0f0f0f0f'], candidates, 4)).toBeNull();
  });

  it('пустые входы → null', () => {
    expect(findDuplicate([], candidates, 8)).toBeNull();
    expect(findDuplicate(['0000000000000000'], [], 8)).toBeNull();
  });
});
