import { randomUUID } from 'node:crypto';
import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import type { RequestWithContext } from '../types/request-context.type.js';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(
    request: RequestWithContext,
    response: Response,
    next: NextFunction,
  ): void {
    const suppliedRequestId = request.header('x-request-id');
    const requestId =
      suppliedRequestId && /^[A-Za-z0-9_-]{1,128}$/.test(suppliedRequestId)
        ? suppliedRequestId
        : randomUUID();

    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);
    next();
  }
}
