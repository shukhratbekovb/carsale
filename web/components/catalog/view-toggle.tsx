'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { LayoutGrid, List } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ViewToggle() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = searchParams.get('view') === 'list' ? 'list' : 'grid';

  function setView(next: 'grid' | 'list') {
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'grid') {
      params.delete('view');
    } else {
      params.set('view', next);
    }
    router.push(`/catalog?${params.toString()}`);
  }

  return (
    <div className="inline-flex items-center rounded-md border p-0.5">
      <button
        type="button"
        aria-label="Вид: галерея"
        aria-pressed={view === 'grid'}
        onClick={() => setView('grid')}
        className={cn(
          'rounded p-1.5',
          view === 'grid' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent'
        )}
      >
        <LayoutGrid className="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Вид: список"
        aria-pressed={view === 'list'}
        onClick={() => setView('list')}
        className={cn(
          'rounded p-1.5',
          view === 'list' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent'
        )}
      >
        <List className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
