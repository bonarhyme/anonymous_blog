import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { MAX_COMMENT_CONTENT_LENGTH } from '../comments.constants.js';

export class CreateCommentDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_COMMENT_CONTENT_LENGTH)
  content!: string;
}
