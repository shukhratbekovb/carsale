import { Suspense } from 'react';
import { GatewaySimulator } from '@/components/payment/gateway-simulator';

// Имитация чекаута шлюза (redirect-flow, frontend-plan.md §5). Не адресуется
// напрямую пользователем — только из GatewaySelect после создания платежа,
// но остаётся обычным маршрутом Next.js (не модалкой), чтобы честно
// демонстрировать переход на «сторонний» домен и обратный редирект.
export default function GatewaySimPage() {
  return (
    <main className="mx-auto flex max-w-md flex-col px-4 py-16">
      <Suspense fallback={<div className="h-40" />}>
        <GatewaySimulator />
      </Suspense>
    </main>
  );
}
