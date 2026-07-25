import { describe, expect, it } from 'vitest';
import {
  type CoreMeProfile,
  type CoreVerifyUser,
  fromMeProfile,
  fromVerifyUser,
} from './session';

describe('session user mappers (§5)', () => {
  it('fromVerifyUser: snake_case verify → canonical SessionUser', () => {
    const core: CoreVerifyUser = {
      id: 'u1',
      role: 'SELLER',
      verification_status: 'PHONE_VERIFIED',
      email: 'a@b.uz',
      marketing_consent: true,
      created_at: '2026-07-25T00:00:00.000Z',
    };
    expect(fromVerifyUser(core)).toEqual({
      id: 'u1',
      role: 'SELLER',
      verificationStatus: 'PHONE_VERIFIED',
      email: 'a@b.uz',
      marketingConsent: true,
      createdAt: '2026-07-25T00:00:00.000Z',
    });
  });

  it('fromMeProfile: camelCase /me (consents.marketing) → canonical SessionUser', () => {
    const me: CoreMeProfile = {
      id: 'u2',
      role: 'BUYER',
      verificationStatus: 'IDENTITY_VERIFIED',
      email: null,
      createdAt: '2026-07-25T00:00:00.000Z',
      consents: { personalData: true, marketing: false, acceptedAt: '2026-07-25T00:00:00.000Z' },
    };
    expect(fromMeProfile(me)).toEqual({
      id: 'u2',
      role: 'BUYER',
      verificationStatus: 'IDENTITY_VERIFIED',
      email: null,
      marketingConsent: false,
      createdAt: '2026-07-25T00:00:00.000Z',
    });
  });
});
