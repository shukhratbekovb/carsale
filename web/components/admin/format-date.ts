// Даты в админке — фиксированный формат ДД.ММ.ГГГГ от UTC-компонентов
// ISO-строки. Intl.DateTimeFormat сознательно не используется: локале- и
// таймзоно-зависимый вывод уже дважды ловил hydration mismatch в проекте
// (см. комментарий в lib/format.ts про Intl.NumberFormat('uz') и UTC+5).
export function formatDateDdMmYyyy(isoDate: string): string {
  const date = new Date(isoDate);
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${date.getUTCFullYear()}`;
}
