'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { FraudFlagBadge } from '@/components/admin/fraud-flag-badge';
import { formatDateDdMmYyyy } from '@/components/admin/format-date';
import { ModerationStatusBadge } from '@/components/admin/moderation-status-badge';
import { RejectForm } from '@/components/admin/reject-form';
import { DealRatingBadge } from '@/components/domain/deal-rating-badge';
import { MileageFlag } from '@/components/domain/mileage-flag';
import { VerifiedBadge } from '@/components/domain/verified-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import { getCityDisplayName } from '@/lib/data/uz-cities';
import { formatMileage, formatUzs } from '@/lib/format';
import { approveListing, rejectListing } from '@/lib/mock/admin';
import { getColorDisplayName } from '@/lib/mock/listing-translations';
import { pushNotification } from '@/lib/mock/notifications';
import type { ModerationItem, RejectReason } from '@/types/admin';

interface ModerationDetailProps {
  item: ModerationItem;
  // Родительская страница держит item в state — после решения обновляем его
  // возвращённым из мока снапшотом (статус + decision), кнопки скрываются.
  onDecided: (item: ModerationItem) => void;
}

// Карточка модерации (UC-15 шаги 3–4): сводка объявления, доказательный
// контекст фрод-флага, профиль продавца и решение опубликовать/отклонить.
export function ModerationDetail({ item, onDecided }: ModerationDetailProps) {
  const t = useTranslations('admin.moderation');
  const tAdmin = useTranslations('admin');
  const tNotifications = useTranslations('notifications');
  const tListing = useTranslations('listing');
  const tListingPage = useTranslations('listingPage');
  const locale = useLocale();
  const [rejectFormOpen, setRejectFormOpen] = useState(false);

  const { listing, seller, fraudFlag } = item;
  const listingTitle = `${listing.make} ${listing.model}, ${listing.year}`;

  // Тот же состав характеристик, что публичная карточка каталога
  // (app/[locale]/catalog/[id]/page.tsx) — подписи переиспользуются
  // из namespace listingPage/listing, без дублирования в admin.
  const specs: Array<[string, string]> = [
    [tListingPage('specs.year'), String(listing.year)],
    [tListingPage('specs.mileage'), formatMileage(listing.mileageKm, locale)],
    [tListingPage('specs.transmission'), tListing(`transmission.${listing.transmission}`)],
    [tListingPage('specs.driveType'), tListing(`driveType.${listing.driveType}`)],
    [tListingPage('specs.condition'), tListing(`condition.${listing.condition}`)],
    [tListingPage('specs.city'), getCityDisplayName(listing.city, locale)],
  ];
  if (listing.color) {
    specs.push([tListingPage('specs.color'), getColorDisplayName(listing.color, locale)]);
  }
  if (listing.engineVolume) {
    specs.push([
      tListingPage('specs.engineVolume'),
      tListingPage('engineVolumeValue', { value: listing.engineVolume }),
    ]);
  }
  if (listing.fuelType) {
    specs.push([tListingPage('specs.fuel'), tListing(`fuelType.${listing.fuelType}`)]);
  }

  // UC-15 шаг 4: продавец получает уведомление о решении. title/message
  // передаются уже переведёнными — у мок-модуля нет доступа к переводам
  // (тот же паттерн, что SellWizard при отправке на модерацию).
  function handleApprove() {
    const updated = approveListing(item.id);
    if (!updated) return;
    onDecided(updated);
    pushNotification(
      'LISTING_STATUS',
      tNotifications('listingApprovedTitle'),
      tNotifications('listingApprovedBody', { listingTitle }),
      '/my-listings'
    );
  }

  function handleReject(reason: RejectReason, comment?: string) {
    const updated = rejectListing(item.id, reason, comment);
    if (!updated) return;
    setRejectFormOpen(false);
    onDecided(updated);
    pushNotification(
      'LISTING_STATUS',
      tNotifications('listingRejectedTitle'),
      tNotifications('listingRejectedBody', {
        listingTitle,
        reason: tAdmin(`rejectReason.${reason}`),
      }),
      '/my-listings'
    );
  }

  return (
    <section>
      <Link
        href="/admin/moderation"
        className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        {t('backToQueue')}
      </Link>

      <div className="mb-1 flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-bold">{listingTitle}</h2>
        <ModerationStatusBadge status={item.status} />
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        {t('flaggedAt', { date: formatDateDdMmYyyy(item.flaggedAt) })}
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('listingTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-2xl font-bold">{formatUzs(listing.priceUzs, locale)}</p>
                <DealRatingBadge label={listing.dealRating.label} />
                {listing.mileageFlag && <MileageFlag reason={listing.mileageFlagReason} />}
              </div>

              <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                {specs.map(([label, value]) => (
                  <div key={label} className="flex justify-between border-b py-1.5 text-sm">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="font-medium">{value}</dd>
                  </div>
                ))}
              </dl>

              {listing.description && (
                <div>
                  <h4 className="mb-1 text-sm font-semibold">{t('descriptionTitle')}</h4>
                  <p className="text-sm text-muted-foreground">{listing.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {item.status === 'PENDING' ? (
            <Card>
              <CardContent className="space-y-4 p-6">
                <div className="flex flex-wrap gap-3">
                  <Button type="button" onClick={handleApprove}>
                    {t('approve')}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    aria-expanded={rejectFormOpen}
                    onClick={() => setRejectFormOpen((open) => !open)}
                  >
                    {t('reject')}
                  </Button>
                </div>
                {rejectFormOpen && (
                  <RejectForm onSubmit={handleReject} onCancel={() => setRejectFormOpen(false)} />
                )}
              </CardContent>
            </Card>
          ) : (
            item.decision && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('decisionTitle')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <ModerationStatusBadge status={item.status} />
                    <span className="text-muted-foreground">
                      {t('decidedAt', { date: formatDateDdMmYyyy(item.decision.decidedAt) })}
                    </span>
                  </div>
                  {item.decision.rejectReason && (
                    <p>
                      <span className="text-muted-foreground">{t('decisionReason')}: </span>
                      <span className="font-medium">
                        {tAdmin(`rejectReason.${item.decision.rejectReason}`)}
                      </span>
                    </p>
                  )}
                  {item.decision.comment && (
                    <p>
                      <span className="text-muted-foreground">{t('decisionComment')}: </span>
                      {item.decision.comment}
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('flagTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <FraudFlagBadge flag={fraudFlag} />
              {fraudFlag.type === 'DUPLICATE_PHOTOS' ? (
                <>
                  <p className="text-muted-foreground">{t('duplicateHint')}</p>
                  {/* Ссылка ведёт на существующую публичную карточку каталога */}
                  <Link
                    href={`/catalog/${fraudFlag.duplicateOfListingId}`}
                    className="inline-block font-medium underline underline-offset-4 hover:text-muted-foreground"
                  >
                    {t('duplicateLink')}
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-muted-foreground">
                    {t('anomalyHint', { percent: fraudFlag.deviationPercent })}
                  </p>
                  {listing.dealRating.recommendedMin !== undefined &&
                    listing.dealRating.recommendedMax !== undefined && (
                      <p className="font-medium">
                        {t('recommendedRange', {
                          min: formatUzs(listing.dealRating.recommendedMin, locale),
                          max: formatUzs(listing.dealRating.recommendedMax, locale),
                        })}
                      </p>
                    )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('sellerTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{seller.name}</p>
                {seller.verified && <VerifiedBadge />}
              </div>
              <dl className="space-y-1.5">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{t('sellerRegisteredAt')}</dt>
                  <dd className="font-medium">{formatDateDdMmYyyy(seller.registeredAt)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{t('sellerActiveListings')}</dt>
                  <dd className="font-medium">{seller.activeListings}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{t('sellerPreviousRejections')}</dt>
                  <dd className="font-medium">{seller.previousRejections}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
