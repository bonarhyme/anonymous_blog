import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import {
  Logger,
  ValidationPipe,
} from '@nestjs/common';
import helmet from 'helmet';

import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  app.use(helmet());

  app.enableCors({
    origin: configService.get<string>('CORS_ORIGINS')?.split(',') ?? [],
    credentials: true,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  });



  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  app.enableShutdownHooks();

  await app.listen(
    configService.get<number>('PORT', 3000),
  );
}

void bootstrap();