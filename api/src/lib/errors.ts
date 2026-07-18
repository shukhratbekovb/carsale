/**
 * Единый формат ошибок API: { error, code, details? } — 09-architecture §5.
 * Ошибки внешних сервисов транслируются в 503 (graceful degradation), не в 500.
 */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: object,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notImplemented = (feature: string): AppError =>
  new AppError(501, 'not_implemented', `${feature} is not implemented yet`);
