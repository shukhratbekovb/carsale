import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const HEADER = 'x-request-id';

/** Сквозной trace ID для межсервисных цепочек (NFR-27): принимаем входящий или генерируем. */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(HEADER);
  const id = incoming && incoming.length <= 128 ? incoming : randomUUID();
  res.locals.requestId = id;
  res.setHeader(HEADER, id);
  next();
}
