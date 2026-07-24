/**
 * Прибавляет N рабочих дней к дате, пропуская сб/вс (BE-9.3, ЗРУ-547 ст. 19–22:
 * удаление ПД ≤ 15 рабочих дней). Совпадает с фронтовым addBusinessDays
 * (web/lib/mock/gdpr.ts). Госпраздники UZ (Навруз, хайиты — плавающие по
 * лунному/указному календарю) не учитываются — это задача с производственным
 * календарём, вне текущего скоупа (задокументировано и во фронт-моке).
 */
export function addBusinessDays(from: Date, businessDays: number): Date {
  const result = new Date(from);
  let remaining = businessDays;
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return result;
}
