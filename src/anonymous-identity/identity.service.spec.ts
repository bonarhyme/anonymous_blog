import {
  ANONYMOUS_ID_COOKIE,
  AnonymousIdentityService,
} from './identity.service.js';

describe('AnonymousIdentityService', () => {
  let service: AnonymousIdentityService;

  beforeEach(() => {
    service = new AnonymousIdentityService();
  });

  it('reuses a valid anonymous_id cookie', () => {
    const anonymousId = '550e8400-e29b-41d4-a716-446655440000';

    expect(service.resolve(`other=value; ${ANONYMOUS_ID_COOKIE}=${anonymousId}`)).toEqual({
      anonymousId,
      shouldSetCookie: false,
    });
  });

  it.each([undefined, '', 'anonymous_id=not-a-uuid', 'anonymous_id=%ZZ']) (
    'generates a fresh UUID for an absent or malformed cookie (%s)',
    (cookieHeader) => {
      const result = service.resolve(cookieHeader);

      expect(result.shouldSetCookie).toBe(true);
      expect(result.anonymousId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    },
  );
});
