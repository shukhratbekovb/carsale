import { createNavigation } from 'next-intl/navigation';
import { routing } from '@/i18n/routing';

// Локале-осведомлённые обёртки над next/link и next/navigation: сохраняют
// активную локаль при внутренней навигации. Для внутренних ссылок использовать
// ТОЛЬКО их, не next/link напрямую — иначе переход сбрасывает язык на дефолтный.
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
