import { useTranslations } from 'next-intl';

// Разделы политики в порядке отображения; ключи — в messages/{uz,ru}.json,
// namespace privacy.sections. Новый раздел = новый ключ здесь и в обеих локалях.
const SECTION_KEYS = [
  'dataCollected',
  'purposes',
  'storage',
  'rights',
  'withdrawal',
  'contact',
] as const;

// Политика конфиденциальности (FE-9, ЗРУ-547). Server component: статичный
// текст из словарей, без клиентской логики. Содержимое — честная заглушка
// по нормам ЗРУ-547 до юридической проверки (см. draftNotice-плашку).
export default function PrivacyPage() {
  const t = useTranslations('privacy');

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold">{t('pageTitle')}</h1>
      {/* text-warning на подложке warning/10 — контраст проверен для FE-8
          (см. fraud-flag-badge.tsx, ~6.5:1, WCAG 2.1 AA) */}
      <p
        role="note"
        className="mt-4 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm font-medium text-warning"
      >
        {t('draftNotice')}
      </p>

      {SECTION_KEYS.map((key) => (
        <section key={key} className="mt-8">
          <h2 className="text-lg font-semibold">{t(`sections.${key}.title`)}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {t(`sections.${key}.body`)}
          </p>
        </section>
      ))}
    </main>
  );
}
