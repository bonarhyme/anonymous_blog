import {
  MiddlewareConsumer,
  Module,
  RequestMethod,
  type NestModule,
} from '@nestjs/common';
import { AnonymousIdentityMiddleware } from './anonymous-identity.middleware.js';
import { AnonymousIdentityService } from './identity.service.js';

@Module({
  providers: [AnonymousIdentityService, AnonymousIdentityMiddleware],
  exports: [AnonymousIdentityService],
})
export class AnonymousIdentityModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AnonymousIdentityMiddleware).forRoutes({
      path: '{*path}',
      method: RequestMethod.ALL,
    });
  }
}
