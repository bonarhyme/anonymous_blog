import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from './dto/pagination.constants.js';
import { MAX_POST_CONTENT_LENGTH } from './posts.constants.js';

interface PostCursor {
	id: string;
	createdAt: Date;
}

@Injectable()
export class PostsService {
	constructor(private readonly prisma: PrismaService) {}

	async create(anonymousId: string, content: string) {
		const normalizedContent = content.trim();
	
		return this.prisma.post.create({
			data: { anonymousId, content: normalizedContent },
			select: {
				id: true,
				content: true,
				createdAt: true,
				updatedAt: true,
			},
		});
	}

	async findAll(limit = DEFAULT_PAGE_SIZE, cursor?: string) {
		const pageSize = Number.isInteger(limit)
			? Math.min(Math.max(limit, 1), MAX_PAGE_SIZE)
			: DEFAULT_PAGE_SIZE;
		const decodedCursor = cursor ? this.decodeCursor(cursor) : undefined;
		const posts = await this.prisma.post.findMany({
			where: {
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
				content: true,
				createdAt: true,
				updatedAt: true,
				_count: {
					select: {
						likes: true,
						comments: { where: { deletedAt: null } },
					},
				},
			},
		});

		const hasMore = posts.length > pageSize;
		const data = posts.slice(0, pageSize).map((post) => ({
			id: post.id,
			content: post.content,
			createdAt: post.createdAt,
			updatedAt: post.updatedAt,
			likeCount: post._count.likes,
			commentCount: post._count.comments,
		}));
		const lastPost = data.at(-1);

		return {
			data,
			nextCursor:
				hasMore && lastPost
					? this.encodeCursor({ id: lastPost.id, createdAt: lastPost.createdAt })
					: null,
		};
	}

	async findOne(id: string) {
		const post = await this.prisma.post.findFirst({
			where: { id, deletedAt: null },
			select: {
				id: true,
				content: true,
				createdAt: true,
				updatedAt: true,
				_count: {
					select: {
						likes: true,
						comments: { where: { deletedAt: null } },
					},
				},
			},
		});

		if (!post) {
			throw new NotFoundException('Post not found.');
		}

		return {
			id: post.id,
			content: post.content,
			createdAt: post.createdAt,
			updatedAt: post.updatedAt,
			likeCount: post._count.likes,
			commentCount: post._count.comments,
		};
	}

	async remove(id: string, anonymousId: string): Promise<void> {
		const result = await this.prisma.post.updateMany({
			where: { id, anonymousId, deletedAt: null },
			data: { deletedAt: new Date() },
		});

		if (result.count > 0) {
			return;
		}

		const existingPost = await this.prisma.post.findUnique({
			where: { id },
			select: { anonymousId: true, deletedAt: true },
		});

		if (!existingPost || existingPost.anonymousId !== anonymousId) {
			throw new NotFoundException('Post not found.');
		}

		// Treat a repeated deletion by the owner as an idempotent success.
		if (existingPost.deletedAt !== null) {
			return;
		}

		throw new NotFoundException('Post not found.');
	}

	private encodeCursor(cursor: PostCursor): string {
		return Buffer.from(
			JSON.stringify({ id: cursor.id, createdAt: cursor.createdAt.toISOString() }),
		).toString('base64url');
	}

	private decodeCursor(cursor: string): PostCursor {
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
