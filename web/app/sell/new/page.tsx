import { SellWizard } from '@/components/sell/sell-wizard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SELL_LABELS } from '@/lib/labels';

// Мастер размещения объявления (FE-3, FR-02/03/05). Логика — в SellWizard и
// lib/sell/wizard-flow.ts, страница только собирает layout (см. app/auth/login).
export default function SellNewPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>{SELL_LABELS.pageTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <SellWizard />
        </CardContent>
      </Card>
    </main>
  );
}
