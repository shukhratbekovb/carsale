import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Заглушка маршрута. Форма ввода телефона + SMS OTP (FR-01, UC-03) — задача FE-2.
export default function LoginPage() {
  return (
    <main className="mx-auto flex max-w-md flex-col px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Вход</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Форма ввода номера телефона появится в задаче FE-2 (Auth UI).
        </CardContent>
      </Card>
    </main>
  );
}
