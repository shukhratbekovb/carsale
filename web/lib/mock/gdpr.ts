import { CONSENTS_STORAGE_KEY, readConsents } from '@/lib/gdpr/consent';
import type { AccountDeletionReceipt, DataExportPayload } from '@/types/gdpr';

// Мок GDPR-эндпоинтов User Module (FE-9, Epic 10, NFR-20/21) до Core API.
// В приложении нет сессии — OTP-флоу не сохраняет вход, поэтому «данные
// пользователя» честно означают «carsale:*-данные этого устройства в
// localStorage» (см. device: true в DataExportPayload).

const MIN_LATENCY_MS = 300;
const MAX_LATENCY_MS = 700;

function mockLatency(): Promise<void> {
  const delay = MIN_LATENCY_MS + Math.random() * (MAX_LATENCY_MS - MIN_LATENCY_MS);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

// Все известные carsale:*-ключи localStorage. При добавлении нового
// device-local ключа в приложении его нужно внести сюда — иначе он не попадёт
// в экспорт и не будет очищен при удалении аккаунта.
export const DEVICE_STORAGE_KEYS = [
  CONSENTS_STORAGE_KEY, // carsale:consents — согласия (lib/gdpr/consent.ts)
  'carsale:favorites', // избранное (hooks/use-favorites.ts)
  'carsale:notification-preferences', // настройки уведомлений FE-7 (hooks/use-notification-preferences.ts)
  'carsale:city', // выбранный город (components/layout/location-picker.tsx)
] as const;

// Читает произвольный carsale:*-ключ как JSON; битые данные → null, а не
// исключение — экспорт не должен падать из-за одного повреждённого ключа.
function readStorageJson(key: string): unknown {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// NFR-20: экспорт данных пользователя. До Core API — снимок device-local
// данных; после подключения бэкенда сюда добавятся серверные данные
// (объявления, чаты, платежи) из GET /users/me/export.
export async function mockExportUserData(): Promise<DataExportPayload> {
  await mockLatency();
  return {
    exportedAt: new Date().toISOString(),
    device: true,
    consents: readConsents(),
    favorites: readStorageJson('carsale:favorites'),
    notificationPreferences: readStorageJson('carsale:notification-preferences'),
    city: readStorageJson('carsale:city'),
  };
}

// +N рабочих дней от даты (пропускаем сб/вс). Государственные праздники UZ
// не учитываем — их календарь плавающий (Навруз, Курбан/Рамазан хайит зависят
// от лунного календаря и объявляются указами), честный расчёт — задача
// бэкенда с актуальным производственным календарём.
function addBusinessDays(from: Date, businessDays: number): Date {
  const result = new Date(from);
  let remaining = businessDays;
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return result;
}

// ЗРУ-547 ст. 19–22: прекращение обработки/уничтожение ПД — не более
// 15 рабочих дней с момента запроса.
const DELETION_DUE_BUSINESS_DAYS = 15;

// NFR-21: запрос удаления аккаунта. На реальном бэкенде это soft delete +
// анонимизация ПД в срок dueBy (объявления/чаты обезличиваются, не стираются
// физически). До Core API удаляем единственное, чем реально владеем, —
// device-local carsale:*-данные этого устройства.
export async function mockRequestAccountDeletion(): Promise<AccountDeletionReceipt> {
  await mockLatency();

  if (typeof window !== 'undefined') {
    try {
      DEVICE_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
    } catch {
      // Недоступный localStorage не должен ломать выдачу квитанции.
    }
  }

  const requestedAt = new Date();
  return {
    requestedAt: requestedAt.toISOString(),
    dueBy: addBusinessDays(requestedAt, DELETION_DUE_BUSINESS_DAYS).toISOString(),
  };
}
