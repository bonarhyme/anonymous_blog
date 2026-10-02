import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { AnonymousId } from '../anonymous-identity/anonymous-id.decorator.js';
import { LikesService } from './likes.service.js';

@Controller('posts/:postId')
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @Post('like')
  like(
    @Param('postId', ParseUUIDPipe) postId: string,
    @AnonymousId() anonymousId: string,
  ) {
    return this.likesService.like(postId, anonymousId);
  }

  @Delete('like')
  @HttpCode(HttpStatus.OK)
  unlike(
    @Param('postId', ParseUUIDPipe) postId: string,
    @AnonymousId() anonymousId: string,
  ) {
    return this.likesService.unlike(postId, anonymousId);
  }

  @Get('like-status')
  getStatus(
    @Param('postId', ParseUUIDPipe) postId: string,
    @AnonymousId() anonymousId: string,
  ) {
    return this.likesService.getStatus(postId, anonymousId);
  }
}
