import { Injectable, type NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Response } from 'express';
import type { RequestWithContext } from '../common/types/request-context.type.js';
import {
  ANONYMOUS_ID_COOKIE,
  ANONYMOUS_ID_COOKIE_MAX_AGE_MS,
  AnonymousIdentityService,
} from './identity.service.js';

@Injectable()
export class AnonymousIdentityMiddleware implements NestMiddleware {
  constructor(
    private readonly identityService: AnonymousIdentityService,
    private readonly configService: ConfigService,
  ) {}

  use(
    request: RequestWithContext,
    response: Response,
    next: NextFunction,
  ): void {
    const resolution = this.identityService.resolve(request.headers.cookie);
    request.anonymousId = resolution.anonymousId;

    if (resolution.shouldSetCookie) {
      response.cookie(ANONYMOUS_ID_COOKIE, resolution.anonymousId, {
        httpOnly: true,
        secure: this.configService.get<string>('NODE_ENV') === 'production',
        sameSite: 'lax',
        maxAge: ANONYMOUS_ID_COOKIE_MAX_AGE_MS,
        path: '/',
      });
    }

    next();
  }
}
