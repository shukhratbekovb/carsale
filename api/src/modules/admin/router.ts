// Admin Module (BE-8, UC-15/16/17): очередь модерации, approve/reject, users suspend/ban, аналитика.
// Только роль ADMIN (RBAC middleware — BE-1.5)
import { stubRouter } from '../stub-router.js';

export const adminRouter = stubRouter('admin');
