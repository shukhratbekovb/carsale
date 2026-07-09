'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormField } from '@/components/forms/form-field';
import { Button } from '@/components/ui/button';
import { AUTH_LABELS } from '@/lib/labels';
import { mockSendOtp } from '@/lib/mock/otp';
import { phoneSchema } from '@/lib/validation/auth';

// phoneSchema валидирует «сырую» строку, а RHF/zodResolver ожидают объектную
// схему формы — оборачиваем поле в объект, не меняя саму бизнес-схему.
const phoneFormSchema = z.object({ phone: phoneSchema });
type PhoneFormValues = z.infer<typeof phoneFormSchema>;

interface PhoneFormProps {
  returnTo?: string;
}

export function PhoneForm({ returnTo }: PhoneFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { control, handleSubmit } = useForm<PhoneFormValues>({
    resolver: zodResolver(phoneFormSchema),
    defaultValues: { phone: '' },
  });

  async function onSubmit(values: PhoneFormValues) {
    setIsSubmitting(true);
    try {
      await mockSendOtp(values.phone);
      const params = new URLSearchParams();
      params.set('phone', values.phone);
      if (returnTo) params.set('return', returnTo);
      router.push(`/auth/otp?${params.toString()}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <FormField
        name="phone"
        control={control}
        label={AUTH_LABELS.phoneLabel}
        placeholder={AUTH_LABELS.phonePlaceholder}
        type="tel"
        autoComplete="tel"
        inputMode="tel"
      />
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? AUTH_LABELS.sendingCode : AUTH_LABELS.getCode}
      </Button>
    </form>
  );
}
