'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { formatDateDdMmYyyy } from '@/lib/format';
import { mockExportUserData, mockRequestAccountDeletion } from '@/lib/mock/gdpr';
import type { AccountDeletionReceipt } from '@/types/gdpr';

// Секция «Мои данные» (FE-9, NFR-20/21, ЗРУ-547 ст. 19–22): экспорт данных
// пользователя JSON-файлом и запрос удаления аккаунта с inline-подтверждением
// (не window.confirm — блокирующие нативные диалоги не стилизуются и хуже
// для a11y) и квитанцией о сроке обработки.
export function GdprSection() {
  const t = useTranslations('profile');
  const [isExporting, setIsExporting] = useState(false);
  const [isConfirmingDeletion, setIsConfirmingDeletion] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [receipt, setReceipt] = useState<AccountDeletionReceipt | null>(null);

  async function handleExport() {
    setIsExporting(true);
    try {
      const payload = await mockExportUserData();
      // Скачивание без сервера: JSON → Blob → временный object-URL → клик по
      // невидимой ссылке. URL освобождаем сразу — файл к этому моменту уже
      // передан механизму загрузки браузера.
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'carsale-data-export.json';
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }

  async function handleConfirmDeletion() {
    setIsDeleting(true);
    try {
      const result = await mockRequestAccountDeletion();
      // mockRequestAccountDeletion уже очистил carsale:*-ключи localStorage.
      // Смонтированные хуки (useFavorites, useNotificationPreferences и др.)
      // держат прочитанное состояние в памяти и очистку не увидят — это
      // осознанно: ничего не перезагружаем и router.refresh() не дёргаем,
      // пользователь спокойно читает квитанцию, а при следующей навигации
      // хуки перечитают уже пустой localStorage.
      setReceipt(result);
    } finally {
      setIsDeleting(false);
      setIsConfirmingDeletion(false);
    }
  }

  return (
    <section aria-labelledby="profile-gdpr-heading" className="rounded-lg border p-4">
      <h2 id="profile-gdpr-heading" className="text-lg font-semibold">
        {t('gdprTitle')}
      </h2>

      {/* Экспорт данных (NFR-20). До Core API — честно только данные устройства. */}
      <p className="mt-1 text-sm text-muted-foreground">{t('exportHint')}</p>
      <Button
        type="button"
        variant="outline"
        onClick={handleExport}
        disabled={isExporting}
        className="mt-3"
      >
        {isExporting ? t('exporting') : t('exportButton')}
      </Button>

      {/* Удаление аккаунта (NFR-21): кнопка → inline-подтверждение → квитанция. */}
      <div className="mt-6 border-t pt-4">
        {receipt ? (
          <p
            role="status"
            className="rounded-md border border-success/40 bg-success/10 p-3 text-sm"
          >
            {t('deletionReceipt', {
              requestedAt: formatDateDdMmYyyy(receipt.requestedAt),
              dueBy: formatDateDdMmYyyy(receipt.dueBy),
            })}
          </p>
        ) : isConfirmingDeletion ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
            <p className="text-sm font-medium">{t('deleteConfirmWarning')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t('deleteConfirmDueNote')}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="destructive"
                onClick={handleConfirmDeletion}
                disabled={isDeleting}
              >
                {isDeleting ? t('deleting') : t('deleteConfirm')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsConfirmingDeletion(false)}
                disabled={isDeleting}
              >
                {t('deleteCancel')}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="destructive"
            onClick={() => setIsConfirmingDeletion(true)}
          >
            {t('deleteButton')}
          </Button>
        )}
      </div>
    </section>
  );
}
