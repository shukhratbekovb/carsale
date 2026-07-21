import type { ListingStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { AppError } from '../../lib/errors.js';
import { assertTransition, canTransition, isEditable } from './status-machine.js';

describe('listing status machine (BE-3.2, 07 §2.1)', () => {
  it('разрешённые переходы', () => {
    expect(canTransition('DRAFT', 'PENDING_MODERATION')).toBe(true);
    expect(canTransition('PENDING_MODERATION', 'PUBLISHED')).toBe(true);
    expect(canTransition('PENDING_MODERATION', 'REJECTED')).toBe(true);
    expect(canTransition('PUBLISHED', 'PENDING_MODERATION')).toBe(true);
    expect(canTransition('PUBLISHED', 'ARCHIVED')).toBe(true);
    expect(canTransition('PUBLISHED', 'SOLD')).toBe(true);
    expect(canTransition('PUBLISHED', 'EXPIRED')).toBe(true);
    expect(canTransition('REJECTED', 'DRAFT')).toBe(true);
    expect(canTransition('ARCHIVED', 'DRAFT')).toBe(true);
  });

  it('запрещённые переходы', () => {
    expect(canTransition('DRAFT', 'PUBLISHED')).toBe(false);
    expect(canTransition('DRAFT', 'REJECTED')).toBe(false);
    expect(canTransition('REJECTED', 'PUBLISHED')).toBe(false);
  });

  it('терминальные статусы никуда не ведут', () => {
    for (const terminal of ['SOLD', 'EXPIRED'] as ListingStatus[]) {
      for (const to of ['DRAFT', 'PUBLISHED', 'PENDING_MODERATION'] as ListingStatus[]) {
        expect(canTransition(terminal, to)).toBe(false);
      }
    }
  });

  it('assertTransition бросает 409 на недопустимом переходе', () => {
    expect(() => assertTransition('DRAFT', 'PENDING_MODERATION')).not.toThrow();
    try {
      assertTransition('SOLD', 'DRAFT');
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).status).toBe(409);
      expect((err as AppError).code).toBe('invalid_status_transition');
    }
  });

  it('isEditable: только DRAFT и REJECTED', () => {
    expect(isEditable('DRAFT')).toBe(true);
    expect(isEditable('REJECTED')).toBe(true);
    expect(isEditable('PUBLISHED')).toBe(false);
    expect(isEditable('PENDING_MODERATION')).toBe(false);
  });
});
