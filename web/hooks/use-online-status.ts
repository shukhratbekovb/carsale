import { useEffect, useState } from 'react';

// Первый рендер (сервер и клиент до гидратации) всегда отдаёт true — как и
// useLocalStorage, navigator.onLine недоступен на сервере, поэтому нельзя
// читать его в инициализаторе useState (иначе клиентский первый рендер
// разойдётся с серверным HTML при реальном офлайне — hydration mismatch,
// тот же класс бага, что был найден и исправлен в useLocalStorage).
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    function handleOnline() {
      setIsOnline(true);
    }
    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
