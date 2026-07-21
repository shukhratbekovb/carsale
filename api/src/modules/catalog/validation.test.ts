import { describe, expect, it } from 'vitest';
import { DEFAULT_PAGE_SIZE, listQuerySchema } from './validation.js';

describe('listQuerySchema (BE-4)', () => {
  it('пустой query → дефолты (sort=date, page=1, pageSize=20)', () => {
    const q = listQuerySchema.parse({});
    expect(q.sort).toBe('date');
    expect(q.page).toBe(1);
    expect(q.pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(q.make).toBeUndefined();
    expect(q.verifiedOnly).toBe(false);
  });

  it('числовые фильтры коэрсятся из строк query', () => {
    const q = listQuerySchema.parse({ yearMin: '2015', priceMax: '150000000', page: '2' });
    expect(q.yearMin).toBe(2015);
    expect(q.priceMax).toBe(150_000_000);
    expect(q.page).toBe(2);
  });

  it('пустые строки трактуются как «не задано»', () => {
    const q = listQuerySchema.parse({ make: '', q: '  ' });
    expect(q.make).toBeUndefined();
    expect(q.q).toBeUndefined();
  });

  it('verifiedOnly=1/true → true', () => {
    expect(listQuerySchema.parse({ verifiedOnly: '1' }).verifiedOnly).toBe(true);
    expect(listQuerySchema.parse({ verifiedOnly: 'true' }).verifiedOnly).toBe(true);
    expect(listQuerySchema.parse({ verifiedOnly: '0' }).verifiedOnly).toBe(false);
  });

  it('невалидный enum отклоняется', () => {
    expect(() => listQuerySchema.parse({ transmission: 'ROCKET' })).toThrow();
    expect(() => listQuerySchema.parse({ sort: 'random' })).toThrow();
  });

  it('pageSize ограничен сверху (max 60)', () => {
    expect(() => listQuerySchema.parse({ pageSize: '500' })).toThrow();
  });
});
