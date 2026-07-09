'use client';

import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { Input, type InputProps } from '@/components/ui/input';
import { getErrorMessage } from '@/lib/form-utils';

interface FormFieldProps<TFieldValues extends FieldValues>
  extends Omit<InputProps, 'name' | 'defaultValue'> {
  name: Path<TFieldValues>;
  control: Control<TFieldValues>;
  label?: string;
}

export function FormField<TFieldValues extends FieldValues>({
  name,
  control,
  label,
  ...inputProps
}: FormFieldProps<TFieldValues>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <div className="w-full">
          {label && (
            <label htmlFor={name} className="mb-1 block text-sm font-medium">
              {label}
            </label>
          )}
          <Input
            id={name}
            {...field}
            value={field.value ?? ''}
            {...inputProps}
            error={getErrorMessage(fieldState.error)}
          />
        </div>
      )}
    />
  );
}
