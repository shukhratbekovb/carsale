import type { FieldError } from 'react-hook-form';

export function getErrorMessage(error?: FieldError): string | undefined {
  return error?.message;
}
