import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/env.js', () => ({
  env: {
    NODE_ENV: 'test',
    S3_ENDPOINT: 'http://localhost:9000',
    S3_PUBLIC_URL: undefined,
    S3_BUCKET_ORIGINALS: 'photos-originals',
    S3_BUCKET_BLURRED: 'photos-blurred',
  },
}));

const repo = vi.hoisted(() => ({
  findOwnedState: vi.fn(),
  createPhoto: vi.fn(),
  listPhotos: vi.fn(),
  // импортируются модулем, но здесь не используются
  createDraft: vi.fn(),
  findEstimateSource: vi.fn(),
  listBySeller: vi.fn(),
  saveDealRating: vi.fn(),
  setStatus: vi.fn(),
  updateDraft: vi.fn(),
}));
vi.mock('./repository.js', () => repo);

const ml = vi.hoisted(() => ({ mlBlur: vi.fn(), mlDealRating: vi.fn() }));
vi.mock('../../lib/ml-client.js', () => ml);

const s3 = vi.hoisted(() => ({ putObject: vi.fn() }));
vi.mock('../../lib/s3.js', () => s3);

vi.mock('../../lib/queue.js', () => ({ publishEvent: vi.fn() }));
vi.mock('../notification/service.js', () => ({ notify: vi.fn() }));

import { addPhoto, getPhotos } from './service.js';

const FILE = { buffer: Buffer.from('rawjpeg'), contentType: 'image/jpeg' };

describe('addPhoto (BE-3.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    s3.putObject.mockResolvedValue(undefined);
  });

  it('нет объявления/не владелец → 404', async () => {
    repo.findOwnedState.mockResolvedValue(null);
    await expect(addPhoto('l1', 's1', FILE)).rejects.toMatchObject({ status: 404, code: 'listing_not_found' });
    expect(ml.mlBlur).not.toHaveBeenCalled();
  });

  it('не редактируемый статус (PUBLISHED) → 409', async () => {
    repo.findOwnedState.mockResolvedValue({ status: 'PUBLISHED', photoCount: 0 });
    await expect(addPhoto('l1', 's1', FILE)).rejects.toMatchObject({ status: 409, code: 'listing_not_editable' });
    expect(s3.putObject).not.toHaveBeenCalled();
  });

  it('достигнут лимит 20 → 400 photo_limit_reached', async () => {
    repo.findOwnedState.mockResolvedValue({ status: 'DRAFT', photoCount: 20 });
    await expect(addPhoto('l1', 's1', FILE)).rejects.toMatchObject({ status: 400, code: 'photo_limit_reached' });
    expect(ml.mlBlur).not.toHaveBeenCalled();
  });

  it('happy: blur → 2 загрузки в MinIO (original+blurred) → createPhoto с public URL', async () => {
    repo.findOwnedState.mockResolvedValue({ status: 'DRAFT', photoCount: 1 });
    ml.mlBlur.mockResolvedValue({ plateDetected: true, regions: [], blurredImage: Buffer.from('blurred') });
    repo.createPhoto.mockImplementation(async (d) => ({
      id: d.id,
      blurredUrl: d.blurredUrl,
      plateDetected: d.plateDetected,
      sortOrder: d.sortOrder,
    }));

    const res = await addPhoto('l1', 's1', FILE);

    expect(ml.mlBlur).toHaveBeenCalledWith(FILE.buffer, 'image/jpeg', undefined);
    // оригинал в private-бакет, blurred в public-бакет
    expect(s3.putObject).toHaveBeenCalledWith('photos-originals', expect.stringMatching(/^originals\/l1\//), FILE.buffer, 'image/jpeg');
    expect(s3.putObject).toHaveBeenCalledWith('photos-blurred', expect.stringMatching(/^blurred\/l1\//), expect.any(Buffer), 'image/jpeg');
    // public URL из S3_ENDPOINT (S3_PUBLIC_URL не задан) + bucket + key
    expect(res.blurredUrl).toMatch(/^http:\/\/localhost:9000\/photos-blurred\/blurred\/l1\/.+\.jpg$/);
    expect(res.plateDetected).toBe(true);
    expect(res.sortOrder).toBe(1);
  });

  it('сбой блюра пробрасывается — фото НЕ сохраняется (нет утечки номера)', async () => {
    repo.findOwnedState.mockResolvedValue({ status: 'DRAFT', photoCount: 0 });
    ml.mlBlur.mockRejectedValue(Object.assign(new Error('blur down'), { status: 503, code: 'blur_unavailable' }));
    await expect(addPhoto('l1', 's1', FILE)).rejects.toMatchObject({ code: 'blur_unavailable' });
    expect(s3.putObject).not.toHaveBeenCalled();
    expect(repo.createPhoto).not.toHaveBeenCalled();
  });
});

describe('getPhotos (BE-3.3)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('не владелец → 404', async () => {
    repo.findOwnedState.mockResolvedValue(null);
    await expect(getPhotos('l1', 's1')).rejects.toMatchObject({ status: 404 });
  });

  it('владелец → маппит строки в DTO', async () => {
    repo.findOwnedState.mockResolvedValue({ status: 'DRAFT', photoCount: 1 });
    repo.listPhotos.mockResolvedValue([{ id: 'p1', blurredUrl: 'u', plateDetected: false, sortOrder: 0 }]);
    const res = await getPhotos('l1', 's1');
    expect(res).toEqual([{ id: 'p1', blurredUrl: 'u', plateDetected: false, sortOrder: 0 }]);
  });
});
