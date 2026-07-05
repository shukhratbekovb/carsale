export const APP_NAME = 'Carsale';
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

// Синхронизировано с картой маршрутов в docs/frontend-plan.md §5
export const ROUTES = {
  home: '/',
  catalog: '/catalog',
  listing: (id: string) => `/catalog/${id}`,
  login: '/auth/login',
  otp: '/auth/otp',
  sellNew: '/sell/new',
  myListings: '/my-listings',
  chat: '/chat',
  chatThread: (threadId: string) => `/chat/${threadId}`,
  payment: (listingId: string) => `/payment/${listingId}`,
  profile: '/profile',
} as const;

export const QUERY_KEYS = {
  user: ['user'],
  listings: ['listings'],
  listing: (id: string) => ['listings', id],
  dealRating: (listingId: string) => ['deal-rating', listingId],
  chatThreads: ['chat-threads'],
} as const;
