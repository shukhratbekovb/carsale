'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { FormField } from '@/components/forms/form-field';
import { Button } from '@/components/ui/button';
import { Link, useRouter } from '@/i18n/navigation';
import {
  canResendOtp,
  createInitialOtpState,
  isLocked,
  resendOtp,
  smsUnavailableFailure,
  startOtpRequest,
  submitOtpFailure,
} from '@/lib/auth/otp-flow';
import { mockSendOtp, mockVerifyOtp } from '@/lib/mock/otp';
import { createOtpCodeSchema } from '@/lib/validation/auth';
import type { OtpFlowState } from '@/types/auth';

type CodeFormValues = { code: string };

type OtpAction =
  | { type: 'START'; phone: string; now: number }
  | { type: 'RESEND'; now: number }
  | { type: 'FAIL'; now: number }
  | { type: 'SMS_UNAVAILABLE' };

// Тонкая обёртка над чистыми функциями lib/auth/otp-flow.ts — сам reducer не
// содержит бизнес-логики, только маршрутизирует действия к нужной функции.
function otpReducer(state: OtpFlowState, action: OtpAction): OtpFlowState {
  switch (action.type) {
    case 'START':
      return startOtpRequest(state, action.phone, action.now);
    case 'RESEND':
      return resendOtp(state, action.now);
    case 'FAIL':
      return submitOtpFailure(state, action.now);
    case 'SMS_UNAVAILABLE':
      return smsUnavailableFailure(state);
    default:
      return state;
  }
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Читает phone/return из query сама (страница /auth/otp оборачивает её в
// Suspense — см. app/[locale]/auth/otp/page.tsx, как это сделано для CatalogFilters).
export function OtpForm() {
  const t = useTranslations('auth');
  const tValidation = useTranslations('validation');
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = searchParams.get('phone');
  const returnTo = searchParams.get('return');

  const [state, dispatch] = useReducer(otpReducer, phone, (initialPhone) =>
    initialPhone ? startOtpRequest(createInitialOtpState(), initialPhone, Date.now()) : createInitialOtpState()
  );
  const [now, setNow] = useState(() => Date.now());
  const [isVerifying, setIsVerifying] = useState(false);
  const sentRef = useRef(false);

  // otpCodeSchema валидирует «сырую» строку — оборачиваем в объект для RHF/zodResolver.
  const codeFormSchema = useMemo(
    () => z.object({ code: createOtpCodeSchema(tValidation) }),
    [tValidation]
  );

  const { control, handleSubmit, reset } = useForm<CodeFormValues>({
    resolver: zodResolver(codeFormSchema),
    defaultValues: { code: '' },
  });

  // Нет номера в URL — сюда нельзя попасть напрямую, возвращаем на ввод номера.
  useEffect(() => {
    if (!phone) {
      router.replace('/auth/login');
    }
  }, [phone, router]);

  // Фактическая отправка SMS при первом входе в CODE_SENT (единственный сайд-эффект
  // здесь; ref защищает от повторного вызова из-за Strict Mode двойного рендера).
  useEffect(() => {
    if (!phone || sentRef.current) return;
    sentRef.current = true;
    mockSendOtp(phone).catch(() => dispatch({ type: 'SMS_UNAVAILABLE' }));
  }, [phone]);

  // Тик раз в секунду — источник "now" для обратных отсчётов resend/lockout и
  // для детектирования истечения блокировки (reducer сам её не снимает).
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Блокировка истекла по таймеру — даём ещё одну попытку (сбрасываем попытки
  // и cooldown повторной отправки через тот же startOtpRequest).
  useEffect(() => {
    if (phone && state.stage === 'LOCKED' && !isLocked(state, now)) {
      dispatch({ type: 'START', phone, now });
      reset({ code: '' });
    }
  }, [phone, state, now, reset]);

  if (!phone) {
    return null;
  }
  // Локальная константа с сужённым типом: TS не переносит narrowing из
  // внешнего `if (!phone) return null` внутрь вложенных function-объявлений ниже.
  const currentPhone: string = phone;

  async function onSubmit(values: CodeFormValues) {
    setIsVerifying(true);
    try {
      const ok = await mockVerifyOtp(currentPhone, values.code);
      if (ok) {
        // Мок-успех: реальной сессии/JWT ещё нет (нет Core API) — просто ведём
        // пользователя дальше. Настоящая сессия подключается отдельной задачей.
        router.push(returnTo || '/');
        return;
      }
      dispatch({ type: 'FAIL', now: Date.now() });
      reset({ code: '' });
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleResend() {
    if (!canResendOtp(state, Date.now())) return;
    dispatch({ type: 'RESEND', now: Date.now() });
    await mockSendOtp(currentPhone).catch(() => dispatch({ type: 'SMS_UNAVAILABLE' }));
  }

  if (state.stage === 'LOCKED') {
    const remainingMs = state.lockedUntil ? state.lockedUntil - now : 0;
    return (
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <p className="text-sm font-medium text-destructive">{t('lockedTitle')}</p>
        <p className="text-2xl font-semibold tabular-nums">{formatCountdown(remainingMs)}</p>
        <p className="text-sm text-muted-foreground">
          {t('lockedMessage', { time: formatCountdown(remainingMs) })}
        </p>
      </div>
    );
  }

  const resendSeconds = state.resendAvailableAt
    ? Math.max(0, Math.ceil((state.resendAvailableAt - now) / 1000))
    : 0;
  const canResend = canResendOtp(state, now);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t('codeSentTo', { phone })}</p>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <FormField
          name="code"
          control={control}
          label={t('codeLabel')}
          placeholder="000000"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
        />

        {state.lastError === 'INVALID_CODE' && (
          <p className="text-sm text-destructive">
            {t('invalidCode', { attemptsRemaining: state.attemptsRemaining })}
          </p>
        )}
        {state.lastError === 'SMS_UNAVAILABLE' && (
          <p className="text-sm text-destructive">{t('smsUnavailable')}</p>
        )}

        <Button type="submit" disabled={isVerifying} className="w-full">
          {isVerifying ? t('verifying') : t('confirm')}
        </Button>
      </form>

      <Button type="button" variant="outline" disabled={!canResend} onClick={handleResend}>
        {canResend ? t('resend') : t('resendIn', { seconds: resendSeconds })}
      </Button>

      <Link
        href={returnTo ? `/auth/login?return=${encodeURIComponent(returnTo)}` : '/auth/login'}
        className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        {t('changePhone')}
      </Link>
    </div>
  );
}
