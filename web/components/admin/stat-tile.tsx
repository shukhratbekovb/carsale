import { Card, CardContent } from '@/components/ui/card';

interface StatTileProps {
  label: string;
  value: number;
}

// Плитка базовой аналитики (UC-17): только число + подпись, без графиков.
// Число рендерится без локальной группировки разрядов — счётчики небольшие,
// а Intl-группировка дала бы SSR/CSR-расхождение (см. lib/format.ts).
export function StatTile({ label, value }: StatTileProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-2xl font-bold">{value}</p>
        <p className="mt-1 text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
