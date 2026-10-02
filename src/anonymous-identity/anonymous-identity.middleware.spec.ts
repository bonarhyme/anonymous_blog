import { ConfigService } from '@nestjs/config';
import type { NextFunction, Response } from 'express';
import type { RequestWithContext } from '../common/types/request-context.type.js';
import { AnonymousIdentityMiddleware } from './anonymous-identity.middleware.js';
import { AnonymousIdentityService } from './identity.service.js';

describe('AnonymousIdentityMiddleware', () => {
  const anonymousId = '550e8400-e29b-41d4-a716-446655440000';

  function createMiddleware(nodeEnv: string) {
    const configService = {
      get: vi.fn().mockReturnValue(nodeEnv),
    } as unknown as ConfigService;
    const setCookie = vi.fn();
    const response = { cookie: setCookie } as unknown as Response;
    const next = vi.fn() as NextFunction;
    const middleware = new AnonymousIdentityMiddleware(
      new AnonymousIdentityService(),
      configService,
    );

    return { middleware, response, next, setCookie };
  }

  it('attaches the generated identity and sets a protected one-year cookie', () => {
    const { middleware, response, next, setCookie } = createMiddleware('test');
    const request = { headers: {} } as RequestWithContext;

    middleware.use(request, response, next);

    expect(request.anonymousId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(setCookie).toHaveBeenCalledWith(
      'anonymous_id',
      request.anonymousId,
      {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 365 * 24 * 60 * 60 * 1000,
        path: '/',
      },
    );
    expect(next).toHaveBeenCalledOnce();
  });

  it('reuses a valid cookie without resetting it', () => {
    const { middleware, response, next, setCookie } =
      createMiddleware('development');
    const request = {
      headers: { cookie: `anonymous_id=${anonymousId}` },
    } as RequestWithContext;

    middleware.use(request, response, next);

    expect(request.anonymousId).toBe(anonymousId);
    expect(setCookie).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });

  it('sets Secure cookies in production', () => {
    const { middleware, response, setCookie } = createMiddleware('production');
    const request = { headers: {} } as RequestWithContext;

    middleware.use(request, response, vi.fn());

    expect(setCookie).toHaveBeenCalledWith(
      'anonymous_id',
      request.anonymousId,
      expect.objectContaining({ secure: true }),
    );
  });
});
