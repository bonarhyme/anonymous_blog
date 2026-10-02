import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnonymousIdentityModule } from './anonymous-identity/anonymous-identity.module.js';
import { validateEnvironment } from './config/environment.validation.js';
import { CommentsModule } from './comments/comments.module.js';
import { CommonModule } from './common/common.module.js';
import { PrismaModule } from './database/prisma.module.js';
import { LikesModule } from './likes/likes.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PostsModule } from './posts/posts.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),
    CommonModule,
    PrismaModule,
    AnonymousIdentityModule,
    PostsModule,
    CommentsModule,
    LikesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
