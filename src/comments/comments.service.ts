import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../posts/dto/pagination.constants.js';
import { MAX_COMMENT_CONTENT_LENGTH } from './comments.constants.js';

interface CommentCursor {
	id: string;
	createdAt: Date;
}

@Injectable()
export class CommentsService {
	constructor(private readonly prisma: PrismaService) {}

	async create(postId: string, anonymousId: string, content: string) {
		const normalizedContent = content.trim();
		if (normalizedContent.length === 0) {
			throw new BadRequestException('Comment content cannot be empty.');
		}
		if (normalizedContent.length > MAX_COMMENT_CONTENT_LENGTH) {
			throw new BadRequestException(
				`Comment content cannot exceed ${MAX_COMMENT_CONTENT_LENGTH} characters.`,
			);
		}

		const post = await this.prisma.post.findFirst({
			where: { id: postId, deletedAt: null },
			select: { id: true },
		});
		if (!post) {
			throw new NotFoundException('Post not found.');
		}

		return this.prisma.comment.create({
			data: {
				postId,
				anonymousId,
				content: normalizedContent,
				parentId: null,
			},
			select: {
				id: true,
				postId: true,
				parentId: true,
				content: true,
				createdAt: true,
				updatedAt: true,
			},
		});
	}

	async findForPost(
		postId: string,
		limit = DEFAULT_PAGE_SIZE,
		cursor?: string,
	) {
		const pageSize = Number.isInteger(limit)
			? Math.min(Math.max(limit, 1), MAX_PAGE_SIZE)
			: DEFAULT_PAGE_SIZE;

		const post = await this.prisma.post.findFirst({
			where: { id: postId, deletedAt: null },
			select: { id: true },
		});
		if (!post) {
			throw new NotFoundException('Post not found.');
		}

		const decodedCursor = cursor ? this.decodeCursor(cursor) : undefined;
		const comments = await this.prisma.comment.findMany({
			where: {
				postId,
				parentId: null,
				deletedAt: null,
				...(decodedCursor && {
					OR: [
						{ createdAt: { lt: decodedCursor.createdAt } },
						{
							createdAt: decodedCursor.createdAt,
							id: { lt: decodedCursor.id },
						},
					],
				}),
			},
			orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
			take: pageSize + 1,
			select: {
				id: true,
				postId: true,
				parentId: true,
				content: true,
				createdAt: true,
				updatedAt: true,
				_count: {
					select: {
						replies: { where: { deletedAt: null } },
					},
				},
			},
		});

		const hasMore = comments.length > pageSize;
		const data = comments.slice(0, pageSize).map((comment) => ({
			id: comment.id,
			postId: comment.postId,
			parentId: comment.parentId,
			content: comment.content,
			createdAt: comment.createdAt,
			updatedAt: comment.updatedAt,
			replyCount: comment._count.replies,
		}));
		const lastComment = data.at(-1);

		return {
			data,
			nextCursor:
				hasMore && lastComment
					? this.encodeCursor({
							id: lastComment.id,
							createdAt: lastComment.createdAt,
						})
					: null,
		};
	}

	async createReply(commentId: string, anonymousId: string, content: string) {
		const normalizedContent = content.trim();
		if (normalizedContent.length === 0) {
			throw new BadRequestException('Comment content cannot be empty.');
		}
		if (normalizedContent.length > MAX_COMMENT_CONTENT_LENGTH) {
			throw new BadRequestException(
				`Comment content cannot exceed ${MAX_COMMENT_CONTENT_LENGTH} characters.`,
			);
		}

		return this.prisma.$transaction(async (transaction) => {
			const parentComment = await transaction.comment.findFirst({
				where: {
					id: commentId,
					parentId: null,
					deletedAt: null,
					post: { deletedAt: null },
				},
				select: { id: true, postId: true },
			});

			if (!parentComment) {
				throw new NotFoundException('Comment not found.');
			}

			return transaction.comment.create({
				data: {
					postId: parentComment.postId,
					parentId: parentComment.id,
					anonymousId,
					content: normalizedContent,
				},
				select: {
					id: true,
					postId: true,
					parentId: true,
					content: true,
					createdAt: true,
					updatedAt: true,
				},
			});
		});
	}

	async findReplies(
		commentId: string,
		limit = DEFAULT_PAGE_SIZE,
		cursor?: string,
	) {
		const pageSize = Number.isInteger(limit)
			? Math.min(Math.max(limit, 1), MAX_PAGE_SIZE)
			: DEFAULT_PAGE_SIZE;

		const parentComment = await this.prisma.comment.findFirst({
			where: {
				id: commentId,
				parentId: null,
				deletedAt: null,
				post: { deletedAt: null },
			},
			select: { id: true, postId: true },
		});
		if (!parentComment) {
			throw new NotFoundException('Comment not found.');
		}

		const decodedCursor = cursor ? this.decodeCursor(cursor) : undefined;
		const replies = await this.prisma.comment.findMany({
			where: {
				postId: parentComment.postId,
				parentId: parentComment.id,
				deletedAt: null,
				...(decodedCursor && {
					OR: [
						{ createdAt: { lt: decodedCursor.createdAt } },
						{
							createdAt: decodedCursor.createdAt,
							id: { lt: decodedCursor.id },
						},
					],
				}),
			},
			orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
			take: pageSize + 1,
			select: {
				id: true,
				postId: true,
				parentId: true,
				content: true,
				createdAt: true,
				updatedAt: true,
			},
		});

		const hasMore = replies.length > pageSize;
		const data = replies.slice(0, pageSize);
		const lastReply = data.at(-1);

		return {
			data,
			nextCursor:
				hasMore && lastReply
					? this.encodeCursor({ id: lastReply.id, createdAt: lastReply.createdAt })
					: null,
		};
	}

	async remove(id: string, anonymousId: string): Promise<void> {
		const result = await this.prisma.comment.updateMany({
			where: { id, anonymousId, deletedAt: null },
			data: { deletedAt: new Date() },
		});

		if (result.count > 0) {
			return;
		}

		const existingComment = await this.prisma.comment.findUnique({
			where: { id },
			select: { anonymousId: true, deletedAt: true },
		});

		if (!existingComment || existingComment.anonymousId !== anonymousId) {
			throw new NotFoundException('Comment not found.');
		}

		// Keep deletion idempotent for the owning anonymous client.
		if (existingComment.deletedAt !== null) {
			return;
		}

		throw new NotFoundException('Comment not found.');
	}

	private encodeCursor(cursor: CommentCursor): string {
		return Buffer.from(
			JSON.stringify({ id: cursor.id, createdAt: cursor.createdAt.toISOString() }),
		).toString('base64url');
	}

	private decodeCursor(cursor: string): CommentCursor {
		try {
			const parsed: unknown = JSON.parse(
				Buffer.from(cursor, 'base64url').toString('utf8'),
			);
			if (typeof parsed !== 'object' || parsed === null) {
				throw new Error('Invalid cursor payload.');
			}

			const candidate = parsed as { id?: unknown; createdAt?: unknown };
			if (
				typeof candidate.id !== 'string' ||
				!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
					candidate.id,
				) ||
				typeof candidate.createdAt !== 'string'
			) {
				throw new Error('Invalid cursor values.');
			}

			const createdAt = new Date(candidate.createdAt);
			if (Number.isNaN(createdAt.getTime())) {
				throw new Error('Invalid cursor date.');
			}

			return { id: candidate.id, createdAt };
		} catch {
			throw new BadRequestException('Invalid pagination cursor.');
		}
	}
}
