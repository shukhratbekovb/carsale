'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { FormField } from '@/components/forms/form-field';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/navigation';
import { mockSendOtp } from '@/lib/mock/otp';
import { createPhoneSchema } from '@/lib/validation/auth';

type PhoneFormValues = { phone: string };

interface PhoneFormProps {
  returnTo?: string;
}

export function PhoneForm({ returnTo }: PhoneFormProps) {
  const t = useTranslations('auth');
  const tValidation = useTranslations('validation');
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // phoneSchema валидирует «сырую» строку, а RHF/zodResolver ожидают объектную
  // схему формы — оборачиваем поле в объект, не меняя саму бизнес-схему.
  const phoneFormSchema = useMemo(
    () => z.object({ phone: createPhoneSchema(tValidation) }),
    [tValidation]
  );

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
        label={t('phoneLabel')}
        placeholder={t('phonePlaceholder')}
        type="tel"
        autoComplete="tel"
        inputMode="tel"
      />
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? t('sendingCode') : t('getCode')}
      </Button>
    </form>
  );
}
