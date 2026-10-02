import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import type { RequestWithContext } from '../common/types/request-context.type.js';

export const AnonymousId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<RequestWithContext>();
    if (!request.anonymousId) {
      throw new InternalServerErrorException(
        'Anonymous identity middleware is not configured for this route.',
      );
    }

    return request.anonymousId;
  },
);
