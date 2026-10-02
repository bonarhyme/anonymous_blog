import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { AnonymousId } from '../anonymous-identity/anonymous-id.decorator.js';
import { CreateCommentDto } from './dto/create-comment.dto.js';
import { ListCommentsQueryDto } from './dto/list-comments-query.dto.js';
import { CommentsService } from './comments.service.js';

@Controller()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post('posts/:postId/comments')
  create(
    @Param('postId', ParseUUIDPipe) postId: string,
    @AnonymousId() anonymousId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.create(postId, anonymousId, dto.content);
  }

  @Get('posts/:postId/comments')
  findForPost(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Query() query: ListCommentsQueryDto,
  ) {
    return this.commentsService.findForPost(postId, query.limit, query.cursor);
  }

  @Post('comments/:commentId/replies')
  createReply(
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @AnonymousId() anonymousId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.createReply(commentId, anonymousId, dto.content);
  }

  @Get('comments/:commentId/replies')
  findReplies(
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Query() query: ListCommentsQueryDto,
  ) {
    return this.commentsService.findReplies(
      commentId,
      query.limit,
      query.cursor,
    );
  }

  @Delete('comments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @AnonymousId() anonymousId: string,
  ): Promise<void> {
    await this.commentsService.remove(id, anonymousId);
  }
}
