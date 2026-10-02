import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class LikesService {
	constructor(private readonly prisma: PrismaService) {}

	async like(postId: string, anonymousId: string) {
		return this.prisma.$transaction(async (transaction) => {
			const post = await transaction.post.findFirst({
				where: { id: postId, deletedAt: null },
				select: { id: true },
			});
			if (!post) {
				throw new NotFoundException('Post not found.');
			}

			// PostgreSQL's unique(postId, anonymousId) constraint serializes
			// concurrent attempts; on conflict, keep the existing like.
			await transaction.postLike.upsert({
				where: { postId_anonymousId: { postId, anonymousId } },
				create: { postId, anonymousId },
				update: {},
			});

			const [liked, likeCount] = await Promise.all([
				transaction.postLike.findUnique({
					where: { postId_anonymousId: { postId, anonymousId } },
					select: { id: true },
				}),
				transaction.postLike.count({ where: { postId } }),
			]);

			return { liked: liked !== null, likeCount };
		});
	}

	async unlike(postId: string, anonymousId: string) {
		return this.prisma.$transaction(async (transaction) => {
			const post = await transaction.post.findFirst({
				where: { id: postId, deletedAt: null },
				select: { id: true },
			});
			if (!post) {
				throw new NotFoundException('Post not found.');
			}

			await transaction.postLike.deleteMany({
				where: { postId, anonymousId },
			});

			const likeCount = await transaction.postLike.count({ where: { postId } });
			return { liked: false, likeCount };
		});
	}

	async getStatus(postId: string, anonymousId: string) {
		const post = await this.prisma.post.findFirst({
			where: { id: postId, deletedAt: null },
			select: {
				id: true,
				_count: { select: { likes: true } },
				likes: {
					where: { anonymousId },
					select: { id: true },
					take: 1,
				},
			},
		});

		if (!post) {
			throw new NotFoundException('Post not found.');
		}

		return {
			liked: post.likes.length > 0,
			likeCount: post._count.likes,
		};
	}
}
