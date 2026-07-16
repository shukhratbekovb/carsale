'use client';

import type { ReactNode } from 'react';
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/lib/form-utils';

interface CheckboxFieldProps<TFieldValues extends FieldValues> {
  name: Path<TFieldValues>;
  control: Control<TFieldValues>;
  // ReactNode, а не string: лейблу согласия нужна inline-ссылка на /privacy
  // (t.rich из next-intl возвращает ReactNode).
  label: ReactNode;
}

// RHF Controller-обёртка над input[type=checkbox] — тот же паттерн, что
// select-field.tsx: лейбл, текст ошибки, aria-invalid/aria-describedby.
// value чекбокса — boolean из event.target.checked, не field.value как строка.
export function CheckboxField<TFieldValues extends FieldValues>({
  name,
  control,
  label,
}: CheckboxFieldProps<TFieldValues>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field: { value, onChange, ...field }, fieldState }) => {
        const error = getErrorMessage(fieldState.error);
        const errorId = `${name}-error`;
        return (
          <div className="w-full">
            <div className="flex items-start gap-2">
              <input
                id={name}
                type="checkbox"
                checked={Boolean(value)}
                onChange={(event) => onChange(event.target.checked)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                {...field}
                className={cn(
                  'mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-input accent-primary',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                  error && 'outline outline-1 outline-destructive'
                )}
              />
              <label htmlFor={name} className="text-sm leading-snug">
                {label}
              </label>
            </div>
            {error && (
              <p id={errorId} className="mt-1 text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
        );
      }}
    />
  );
}
