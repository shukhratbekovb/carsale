import { useEffect, useState } from 'react';

// Первый рендер (сервер и клиент до гидратации) всегда отдаёт initialValue —
// значение из localStorage подхватывается только в эффекте после монтирования.
// Если читать localStorage прямо в useState-инициализаторе, клиентский первый
// рендер расходится с серверным HTML (там window нет) — React бросает
// hydration mismatch. Пример: LocationPicker с ранее выбранным городом или
// useFavorites с непустым избранным — оба потребителя этого хука.
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item !== null) setStoredValue(JSON.parse(item));
    } catch {
      // Повреждённое значение в сторедже — остаёмся на initialValue.
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    // До гидратации storedValue ещё не отражает реальный localStorage —
    // запись сейчас затёрла бы его дефолтом раньше, чем эффект чтения успеет отработать.
    if (!hydrated) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch {
      // Квота/сериализация — не блокируем UI из-за ошибки записи в сторедж.
    }
  }, [key, storedValue, hydrated]);

  return [storedValue, setStoredValue];
}
