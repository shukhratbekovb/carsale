// Мок замена реальной интеграции Eskiz SMS + Core API до её готовности (FE-2).
// Все функции симулируют сетевую задержку через setTimeout; заменить на реальные
// вызовы API, когда бэкенд будет доступен.

// Фиксированный dev-код: в моке любой номер телефона подтверждается этим кодом.
// Убрать при подключении настоящего Core API.
export const MOCK_OTP_CODE = '000000';

const MIN_LATENCY_MS = 400;
const MAX_LATENCY_MS = 800;

function mockLatency(): Promise<void> {
  const delay = MIN_LATENCY_MS + Math.random() * (MAX_LATENCY_MS - MIN_LATENCY_MS);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

// Отправка SMS с кодом. В моке всегда успешна — UI-агент может добавить свой
// dev-переключатель для симуляции SMS_UNAVAILABLE (это не забота этой функции).
export async function mockSendOtp(phone: string): Promise<{ ok: true }> {
  void phone;
  await mockLatency();
  return { ok: true };
}

// Проверка кода. Резолвится в true только если код совпадает с MOCK_OTP_CODE.
export async function mockVerifyOtp(phone: string, code: string): Promise<boolean> {
  void phone;
  await mockLatency();
  return code === MOCK_OTP_CODE;
}
