// Auth Module (BE-1, FR-01, §6.1): POST /otp/send, POST /otp/verify, POST /refresh, POST /logout
import { stubRouter } from '../stub-router.js';

export const authRouter = stubRouter('auth');
