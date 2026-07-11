'use client';

import { useId, useMemo, useState } from 'react';
import { Loader2, MapPin, Navigation } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { DEFAULT_CITY, UZ_CITIES } from '@/lib/data/uz-cities';
import { findNearestCity } from '@/lib/geo';
import { cn } from '@/lib/utils';

export function LocationPicker() {
  const t = useTranslations('locationPicker');
  const [city, setCity] = useLocalStorage('carsale:city', DEFAULT_CITY);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelId = useId();

  const filteredCities = useMemo(
    () => UZ_CITIES.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase())),
    [query]
  );

  function selectCity(name: string) {
    setCity(name);
    setOpen(false);
    setQuery('');
    setError(null);
  }

  function detectLocation() {
    if (!navigator.geolocation) {
      setError(t('geoUnsupported'));
      return;
    }
    setDetecting(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        selectCity(findNearestCity(position.coords.latitude, position.coords.longitude));
        setDetecting(false);
      },
      () => {
        setError(t('geoFailed'));
        setDetecting(false);
      },
      { timeout: 8000 }
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      >
        <MapPin className="h-4 w-4" aria-hidden="true" />
        {city}
      </button>
      {open && (
        <div
          id={panelId}
          className="absolute left-0 top-full z-20 mt-2 w-72 rounded-lg border bg-background p-3 shadow-lg"
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="mb-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="button"
            onClick={detectLocation}
            disabled={detecting}
            className="mb-3 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-primary hover:bg-accent disabled:opacity-50"
          >
            {detecting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Navigation className="h-4 w-4" aria-hidden="true" />
            )}
            {t('detect')}
          </button>
          {error && <p className="mb-2 text-xs text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2">
            {filteredCities.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => selectCity(c.name)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs',
                  c.name === city ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent'
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
