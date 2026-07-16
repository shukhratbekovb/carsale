'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { REJECT_REASON_VALUES, type RejectReason } from '@/types/admin';

// Форма отклонения (UC-15 шаг 4): обязательный select причины + необязательный
// комментарий. Два поля — локальный useState, RHF+Zod здесь избыточны.
const selectClassName =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

interface RejectFormProps {
  onSubmit: (reason: RejectReason, comment?: string) => void;
  onCancel: () => void;
}

export function RejectForm({ onSubmit, onCancel }: RejectFormProps) {
  const t = useTranslations('admin.moderation');
  const tAdmin = useTranslations('admin');
  const reasonId = useId();
  const commentId = useId();
  const [reason, setReason] = useState<RejectReason | ''>('');
  const [comment, setComment] = useState('');

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!reason) return;
        onSubmit(reason, comment.trim() || undefined);
      }}
      className="space-y-3 border-t pt-4"
    >
      <div>
        <label htmlFor={reasonId} className="mb-1 block text-sm font-medium">
          {t('rejectReasonLabel')}
        </label>
        <select
          id={reasonId}
          required
          value={reason}
          onChange={(event) => setReason(event.target.value as RejectReason | '')}
          className={selectClassName}
        >
          <option value="" disabled>
            {t('rejectReasonPlaceholder')}
          </option>
          {REJECT_REASON_VALUES.map((value) => (
            <option key={value} value={value}>
              {tAdmin(`rejectReason.${value}`)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor={commentId} className="mb-1 block text-sm font-medium">
          {t('rejectCommentLabel')}
        </label>
        <textarea
          id={commentId}
          rows={3}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="destructive" disabled={!reason}>
          {t('rejectSubmit')}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('rejectCancel')}
        </Button>
      </div>
    </form>
  );
}
