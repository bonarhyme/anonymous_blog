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
  UseGuards,
} from '@nestjs/common';
import { AnonymousId } from '../anonymous-identity/anonymous-id.decorator.js';
import { CreatePostDto } from './dto/create-post.dto.js';
import { ListPostsQueryDto } from './dto/list-posts-query.dto.js';
import { PostsService } from './posts.service.js';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';


@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  create(
    @AnonymousId() anonymousId: string,
    @Body() dto: CreatePostDto,
  ) {
    return this.postsService.create(anonymousId, dto.content);
  }

  @Get()
  findAll(@Query() query: ListPostsQueryDto) {
    return this.postsService.findAll(query.limit, query.cursor);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.postsService.findOne(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @AnonymousId() anonymousId: string,
  ): Promise<void> {
    await this.postsService.remove(id, anonymousId);
  }
}
