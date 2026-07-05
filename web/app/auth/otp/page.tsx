import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Заглушка маршрута. Ввод OTP с таймером/ретраем/блокировкой (FR-01, UC-03) — задача FE-2.
export default function OtpPage() {
  return (
    <main className="mx-auto flex max-w-md flex-col px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Подтверждение кода</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Форма ввода OTP-кода появится в задаче FE-2 (Auth UI).
        </CardContent>
      </Card>
    </main>
  );
}
