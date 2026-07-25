import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchCatalog, fetchListing } from './api';

function stubFetch(status: number, body: unknown) {
  const res = {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
  const mock = vi.fn().mockResolvedValue(res);
  vi.stubGlobal('fetch', mock);
  return mock;
}

afterEach(() => vi.unstubAllGlobals());

describe('fetchCatalog (§5)', () => {
  it('форвардит whitelisted query, игнорирует чужие ключи (view), маппит page_size', async () => {
    const mock = stubFetch(200, { items: [{ id: '1' }], total: 1, page: 1, page_size: 20 });
    const res = await fetchCatalog({
      make: 'Chevrolet',
      priceMax: '100000000',
      sort: 'price',
      view: 'list', // фронтовый ключ — Core его не должен получить
    });

    expect(res).toEqual({ items: [{ id: '1' }], total: 1, page: 1, pageSize: 20, similar: [] });
    const url = mock.mock.calls[0][0] as string;
    expect(url).toContain('/listings?');
    expect(url).toContain('make=Chevrolet');
    expect(url).toContain('priceMax=100000000');
    expect(url).toContain('sort=price');
    expect(url).not.toContain('view=');
  });

  it('берёт первое значение из массива и пропускает пустые строки', async () => {
    const mock = stubFetch(200, { items: [], total: 0, page: 1, page_size: 20, similar: [{ id: '9' }] });
    const res = await fetchCatalog({ make: ['Kia', 'BMW'], city: '' });

    expect(res.similar).toEqual([{ id: '9' }]);
    const url = mock.mock.calls[0][0] as string;
    expect(url).toContain('make=Kia');
    expect(url).not.toContain('city=');
  });

  it('non-ok → бросает', async () => {
    stubFetch(500, {});
    await expect(fetchCatalog({})).rejects.toThrow(/catalog fetch failed: 500/);
  });
});

describe('fetchListing (§5)', () => {
  it('200 → объявление', async () => {
    stubFetch(200, { id: 'abc', make: 'Chevrolet' });
    await expect(fetchListing('abc')).resolves.toMatchObject({ id: 'abc' });
  });

  it('404 → null (без броска)', async () => {
    stubFetch(404, { error: 'not found', code: 'listing_not_found' });
    await expect(fetchListing('missing-id')).resolves.toBeNull();
  });

  it('прочий non-ok → бросает', async () => {
    stubFetch(503, {});
    await expect(fetchListing('err-id')).rejects.toThrow(/listing fetch failed: 503/);
  });
});
