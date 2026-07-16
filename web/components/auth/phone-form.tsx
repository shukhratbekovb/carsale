'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { CheckboxField } from '@/components/forms/checkbox-field';
import { FormField } from '@/components/forms/form-field';
import { Button } from '@/components/ui/button';
import { Link, useRouter } from '@/i18n/navigation';
import { saveConsents } from '@/lib/gdpr/consent';
import { mockSendOtp } from '@/lib/mock/otp';
import { createPhoneSchema, createRegistrationConsentSchema } from '@/lib/validation/auth';

type PhoneFormValues = {
  phone: string;
  personalDataConsent: boolean;
  marketingConsent: boolean;
};

interface PhoneFormProps {
  returnTo?: string;
}

export function PhoneForm({ returnTo }: PhoneFormProps) {
  const t = useTranslations('auth');
  const tValidation = useTranslations('validation');
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // phoneSchema валидирует «сырую» строку, а RHF/zodResolver ожидают объектную
  // схему формы — оборачиваем поле в объект и добавляем согласия при
  // регистрации (FE-9, ЗРУ-547) через spread shape готовой consent-схемы.
  const phoneFormSchema = useMemo(
    () =>
      z.object({
        phone: createPhoneSchema(tValidation),
        ...createRegistrationConsentSchema(tValidation).shape,
      }),
    [tValidation]
  );

  const { control, handleSubmit } = useForm<PhoneFormValues>({
    // z.literal(true) сужает тип personalDataConsent до литерала true, а
    // невыбранный чекбокс — boolean false; кастуем резолвер к типу формы с
    // boolean (тот же приём, что в sell/vehicle-details-step.tsx).
    resolver: zodResolver(phoneFormSchema) as Resolver<PhoneFormValues>,
    defaultValues: { phone: '', personalDataConsent: false, marketingConsent: false },
  });

  async function onSubmit(values: PhoneFormValues) {
    setIsSubmitting(true);
    try {
      await mockSendOtp(values.phone);
      // Согласия фиксируются на устройстве в момент регистрации, до перехода
      // на OTP-шаг: базовое согласие к этому моменту гарантированно дано
      // (схема не пропустит false), маркетинговое — по выбору пользователя.
      saveConsents({ personalData: true, marketing: values.marketingConsent });
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
      {/* Согласия при регистрации (FE-9, ЗРУ-547): обязательная обработка ПД
          со ссылкой на политику + опциональный маркетинг. Ссылка открывается
          в новой вкладке, чтобы не терять введённый номер. */}
      <CheckboxField
        name="personalDataConsent"
        control={control}
        label={t.rich('personalDataConsentLabel', {
          privacyLink: (chunks) => (
            <Link
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline underline-offset-2 hover:text-primary"
            >
              {chunks}
            </Link>
          ),
        })}
      />
      <CheckboxField
        name="marketingConsent"
        control={control}
        label={t('marketingConsentLabel')}
      />
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? t('sendingCode') : t('getCode')}
      </Button>
    </form>
  );
}
