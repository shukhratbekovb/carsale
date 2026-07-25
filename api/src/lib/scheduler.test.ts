import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scheduleJob, stopAllJobs } from './scheduler.js';

describe('scheduler (BE-3.7)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    stopAllJobs();
    vi.useRealTimers();
  });

  it('запускает job по интервалу', async () => {
    const job = vi.fn(async () => {});
    scheduleJob('t', 1000, job);
    expect(job).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(job).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(job).toHaveBeenCalledTimes(3);
  });

  it('ошибка job не роняет планировщик — следующий тик выполняется', async () => {
    const job = vi.fn(async () => {
      throw new Error('boom');
    });
    scheduleJob('t', 1000, job);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(job).toHaveBeenCalledTimes(2); // не остановился после ошибки
  });

  it('stopAllJobs останавливает интервалы', async () => {
    const job = vi.fn(async () => {});
    scheduleJob('t', 1000, job);
    stopAllJobs();
    await vi.advanceTimersByTimeAsync(5000);
    expect(job).not.toHaveBeenCalled();
  });
});
