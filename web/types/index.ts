// Соответствует публичному профилю USER из analysis/08-data-model.md.
// phone_hash, VIN и госномер — внутренние поля, в публичном API не возвращаются (BR-3, NFR-15).
export interface User {
  id: string;
  email?: string;
  role: 'BUYER' | 'SELLER' | 'ADMIN';
  verificationStatus: 'UNVERIFIED' | 'PHONE_VERIFIED' | 'IDENTITY_VERIFIED' | 'SUSPENDED' | 'BANNED';
  createdAt: string;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
