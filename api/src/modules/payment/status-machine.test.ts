import { describe, expect, it } from 'vitest';
import { AppError } from '../../lib/errors.js';
import { assertTransition, canTransition, isTerminal } from './status-machine.js';

describe('payment status-machine (BE-6, 07 §2.3)', () => {
  it('разрешённые переходы', () => {
    expect(canTransition('PENDING', 'PROCESSING')).toBe(true);
    expect(canTransition('PROCESSING', 'SUCCESS')).toBe(true);
    expect(canTransition('PROCESSING', 'FAILED')).toBe(true);
    expect(canTransition('PROCESSING', 'CANCELLED')).toBe(true);
    expect(canTransition('FAILED', 'PENDING')).toBe(true);
    expect(canTransition('SUCCESS', 'REFUNDED')).toBe(true);
  });

  it('запрещённые переходы', () => {
    expect(canTransition('PENDING', 'SUCCESS')).toBe(false);
    expect(canTransition('SUCCESS', 'FAILED')).toBe(false);
    expect(canTransition('CANCELLED', 'PROCESSING')).toBe(false);
    expect(canTransition('REFUNDED', 'SUCCESS')).toBe(false);
  });

  it('assertTransition бросает 409 на запрещённом', () => {
    expect(() => assertTransition('SUCCESS', 'FAILED')).toThrow(AppError);
    try {
      assertTransition('SUCCESS', 'FAILED');
    } catch (e) {
      expect((e as AppError).status).toBe(409);
      expect((e as AppError).code).toBe('invalid_status_transition');
    }
  });

  it('isTerminal: SUCCESS/CANCELLED/REFUNDED терминальны, PENDING/PROCESSING/FAILED — нет', () => {
    expect(isTerminal('SUCCESS')).toBe(true);
    expect(isTerminal('CANCELLED')).toBe(true);
    expect(isTerminal('REFUNDED')).toBe(true);
    expect(isTerminal('PENDING')).toBe(false);
    expect(isTerminal('PROCESSING')).toBe(false);
    expect(isTerminal('FAILED')).toBe(false);
  });
});
