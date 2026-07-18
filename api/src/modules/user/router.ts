// User Module (BE-9, NFR-18–21, ЗРУ-547): профиль, согласия, экспорт данных,
// удаление аккаунта (soft delete + анонимизация, SLA 15 раб. дней)
import { stubRouter } from '../stub-router.js';

export const userRouter = stubRouter('user');
