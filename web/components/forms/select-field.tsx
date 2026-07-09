'use client';

import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/lib/form-utils';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps<TFieldValues extends FieldValues> {
  name: Path<TFieldValues>;
  control: Control<TFieldValues>;
  label?: string;
  options: SelectOption[];
  placeholder?: string;
}

export function SelectField<TFieldValues extends FieldValues>({
  name,
  control,
  label,
  options,
  placeholder,
}: SelectFieldProps<TFieldValues>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        const error = getErrorMessage(fieldState.error);
        return (
          <div className="w-full">
            {label && (
              <label htmlFor={name} className="mb-1 block text-sm font-medium">
                {label}
              </label>
            )}
            <select
              id={name}
              {...field}
              value={field.value ?? ''}
              className={cn(
                'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2',
                'text-sm ring-offset-background',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'disabled:cursor-not-allowed disabled:opacity-50',
                error && 'border-destructive focus-visible:ring-destructive'
              )}
            >
              {placeholder && (
                <option value="" disabled>
                  {placeholder}
                </option>
              )}
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
          </div>
        );
      }}
    />
  );
}
