// Подмножество сигнатуры t() из next-intl (namespace `validation`), достаточное
// для сообщений Zod-схем. Схемы валидации — фабрики, принимающие переводчик:
// сообщения об ошибках локализуются так же, как остальной UI (NFR-28),
// а сами схемы остаются чистыми и тестируются с createTranslator без React.
export type ValidationTranslator = (
  key: string,
  values?: Record<string, string | number>
) => string;
