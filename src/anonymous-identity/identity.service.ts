import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

export const ANONYMOUS_ID_COOKIE = 'anonymous_id';
export const ANONYMOUS_ID_COOKIE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

export interface AnonymousIdentityResolution {
  anonymousId: string;
  shouldSetCookie: boolean;
}

@Injectable()
export class AnonymousIdentityService {
  resolve(cookieHeader: string | undefined): AnonymousIdentityResolution {
    const cookieValue = this.readAnonymousIdCookie(cookieHeader);

    if (cookieValue && this.isUuid(cookieValue)) {
      return { anonymousId: cookieValue, shouldSetCookie: false };
    }

    return { anonymousId: randomUUID(), shouldSetCookie: true };
  }

  private readAnonymousIdCookie(cookieHeader: string | undefined): string | undefined {
    if (!cookieHeader) {
      return undefined;
    }

    const cookie = cookieHeader.split(';').find((part) => {
      const separatorIndex = part.indexOf('=');
      return (
        separatorIndex >= 0 &&
        part.slice(0, separatorIndex).trim() === ANONYMOUS_ID_COOKIE
      );
    });

    if (!cookie) {
      return undefined;
    }

    const value = cookie.slice(cookie.indexOf('=') + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }
}