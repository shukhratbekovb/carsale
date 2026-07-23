/**
 * Расстояние Хэмминга между перцептивными хешами (hex-строки, BE-2.5/3.6).
 * pHash — 64 бита = 16 hex-символов; сравниваем понибблово (без BigInt).
 * Малое расстояние (≤ порога) → фото визуально совпадают (дубль).
 */

// popcount каждого 4-битного значения 0..15
const NIBBLE_BITS = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

export function hammingDistance(a: string, b: string): number {
  // Разной длины/битые хеши не сравниваем — «бесконечно далеко»
  if (a.length !== b.length || a.length === 0) return Number.MAX_SAFE_INTEGER;
  let dist = 0;
  for (let i = 0; i < a.length; i += 1) {
    const x = Number.parseInt(a[i] ?? '', 16);
    const y = Number.parseInt(b[i] ?? '', 16);
    if (Number.isNaN(x) || Number.isNaN(y)) return Number.MAX_SAFE_INTEGER;
    dist += NIBBLE_BITS[x ^ y] ?? 0;
  }
  return dist;
}

/** Есть ли среди candidates хеш в пределах порога от любого из hashes. */
export function findDuplicate(
  hashes: string[],
  candidates: { listingId: string; phash: string }[],
  maxDistance: number,
): string | null {
  for (const c of candidates) {
    for (const h of hashes) {
      if (hammingDistance(h, c.phash) <= maxDistance) return c.listingId;
    }
  }
  return null;
}
