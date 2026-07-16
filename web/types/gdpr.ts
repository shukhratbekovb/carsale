// Типы GDPR/ЗРУ-547-функций профиля (FE-9, Epic 10, NFR-20/21): согласия на
// обработку персональных данных, экспорт данных и запрос удаления аккаунта.
// Пока нет сессии/Core API, «данные пользователя» = device-local данные из
// localStorage этого устройства (см. lib/mock/gdpr.ts).

export interface ConsentState {
  // Обязательное согласие на обработку ПД (ЗРУ-547) — без него сервис не
  // вправе обрабатывать данные пользователя.
  personalData: boolean;
  // Отдельное согласие на маркетинговые коммуникации — отзываемое независимо
  // от базового (PRD 7.2: отзыв согласия через настройки профиля).
  marketing: boolean;
  // ISO-момент последнего явного принятия согласий; отсутствует, пока
  // пользователь ни разу не сохранял согласия.
  acceptedAt?: string;
}

export const DEFAULT_CONSENT_STATE: ConsentState = {
  personalData: false,
  marketing: false,
};

// Экспорт данных пользователя (NFR-20, право на переносимость). До Core API
// собирается только с устройства — поле device: true явно маркирует этот
// scope, чтобы UI/потребители не путали его с полноценным серверным экспортом.
export interface DataExportPayload {
  exportedAt: string;
  device: true;
  consents: ConsentState;
  // Содержимое carsale:*-ключей localStorage как есть (unknown — формат
  // валидируется владельцами соответствующих ключей, а не экспортом);
  // битый JSON в ключе превращается в null.
  favorites: unknown; // carsale:favorites — id избранных объявлений
  notificationPreferences: unknown; // carsale:notification-preferences — per-type настройки FE-7
  city: unknown; // carsale:city — выбранный город (LocationPicker)
}

// Квитанция о запросе удаления аккаунта (NFR-21). По ЗРУ-547 (ст. 19–22)
// оператор обязан прекратить обработку/уничтожить ПД в срок не более
// 15 рабочих дней — dueBy рассчитывается от requestedAt с учётом выходных.
export interface AccountDeletionReceipt {
  requestedAt: string;
  dueBy: string;
}
