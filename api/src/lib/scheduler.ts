import { logger } from './logger.js';

/**
 * Простой периодический планировщик (BE-3.7). setInterval с `unref` (не держит
 * event loop), ошибки job'а логируются и не роняют процесс. Достаточно для
 * cron-задач жизненного цикла объявления (EXPIRED, retry Deal Rating); для
 * распределённого шедулинга в будущем — вынести в отдельный worker/leader-lock.
 */

export type Job = () => Promise<void>;

interface RegisteredJob {
  name: string;
  timer: NodeJS.Timeout;
}

const jobs: RegisteredJob[] = [];

export function scheduleJob(name: string, intervalMs: number, job: Job): void {
  const run = (): void => {
    void job().catch((err) => logger.error({ err, job: name }, 'scheduled job failed'));
  };
  const timer = setInterval(run, intervalMs);
  timer.unref();
  jobs.push({ name, timer });
  logger.info({ job: name, intervalMs }, 'scheduler: job registered');
}

/** Остановить все задачи (graceful shutdown / тесты). */
export function stopAllJobs(): void {
  for (const j of jobs) clearInterval(j.timer);
  jobs.length = 0;
}
