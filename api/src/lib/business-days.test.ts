import { describe, expect, it } from 'vitest';
import { addBusinessDays } from './business-days.js';

function mondayOnOrAfter(d: Date): Date {
  const r = new Date(d);
  while (r.getDay() !== 1) r.setDate(r.getDate() + 1);
  return r;
}

describe('addBusinessDays (BE-9.3, ЗРУ-547)', () => {
  const monday = mondayOnOrAfter(new Date(2026, 0, 5));

  it('+0 → та же дата', () => {
    expect(addBusinessDays(monday, 0).getTime()).toBe(monday.getTime());
  });

  it('+1 от понедельника → вторник', () => {
    expect(addBusinessDays(monday, 1).getDay()).toBe(2);
  });

  it('+5 рабочих от будня → ровно +7 календарных (пропущены выходные)', () => {
    const res = addBusinessDays(monday, 5);
    const expected = new Date(monday);
    expected.setDate(monday.getDate() + 7);
    expect(res.getDate()).toBe(expected.getDate());
    expect(res.getDay()).toBe(1); // снова понедельник
  });

  it('+1 от субботы → понедельник', () => {
    const saturday = new Date(monday);
    saturday.setDate(monday.getDate() + 5);
    expect(saturday.getDay()).toBe(6);
    expect(addBusinessDays(saturday, 1).getDay()).toBe(1);
  });

  it('+15 рабочих дней всегда будень', () => {
    const res = addBusinessDays(monday, 15);
    expect(res.getDay()).not.toBe(0);
    expect(res.getDay()).not.toBe(6);
  });
});
