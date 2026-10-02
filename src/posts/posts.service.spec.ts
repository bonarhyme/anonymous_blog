import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { PostsService } from './posts.service.js';

describe('PostsService', () => {
  let service: PostsService;
  let prisma: {
    post: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prisma = {
      post: {
        create: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        updateMany: vi.fn(),
        findUnique: vi.fn(),
      },
    };
    service = new PostsService(prisma as unknown as PrismaService);
  });

  it('trims content and persists the request identity when creating a post', async () => {
    prisma.post.create.mockResolvedValue({ id: 'post-id' });

    await service.create('anonymous-id', '  hello world  ');

    expect(prisma.post.create).toHaveBeenCalledWith({
      data: { anonymousId: 'anonymous-id', content: 'hello world' },
      select: {
        id: true,
        content: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  // it('rejects whitespace-only content', async () => {
  //   await expect(service.create('anonymous-id', '  \n  ')).rejects.toBeInstanceOf(
  //     BadRequestException,
  //   );
  //   expect(prisma.post.create).not.toHaveBeenCalled();
  // });

  it('lists only active posts with a bounded, stable, counted page', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    prisma.post.findMany.mockResolvedValue([
      {
        id: '00000000-0000-4000-8000-000000000003',
        content: 'one',
        createdAt,
        updatedAt: createdAt,
        _count: { likes: 2, comments: 3 },
      },
      {
        id: '00000000-0000-4000-8000-000000000002',
        content: 'two',
        createdAt,
        updatedAt: createdAt,
        _count: { likes: 1, comments: 0 },
      },
      {
        id: '00000000-0000-4000-8000-000000000001',
        content: 'three',
        createdAt,
        updatedAt: createdAt,
        _count: { likes: 0, comments: 0 },
      },
    ]);

    const result = await service.findAll(2);

    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 3,
        select: expect.objectContaining({
          _count: {
            select: {
              likes: true,
              comments: { where: { deletedAt: null } },
            },
          },
        }),
      }),
    );
    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toMatchObject({ likeCount: 2, commentCount: 3 });
    expect(result.nextCursor).toBeTruthy();
    expect(JSON.stringify(result)).not.toContain('anonymousId');
  });

  it('uses a validated keyset cursor for the next page', async () => {
    const cursorDate = '2026-01-01T00:00:00.000Z';
    const cursorId = '00000000-0000-4000-8000-000000000003';
    const cursor = Buffer.from(
      JSON.stringify({ id: cursorId, createdAt: cursorDate }),
    ).toString('base64url');
    prisma.post.findMany.mockResolvedValue([]);

    await service.findAll(10, cursor);

    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
          OR: [
            { createdAt: { lt: new Date(cursorDate) } },
            { createdAt: new Date(cursorDate), id: { lt: cursorId } },
          ],
        },
        take: 11,
      }),
    );
  });

  it('rejects an invalid cursor', async () => {
    await expect(service.findAll(10, 'not-a-cursor')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.post.findMany).not.toHaveBeenCalled();
  });

  it('returns 404 when a post is missing or deleted', async () => {
    prisma.post.findFirst.mockResolvedValue(null);

    await expect(service.findOne('post-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.post.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'post-id', deletedAt: null } }),
    );
  });

  it('soft deletes only an active post owned by the anonymous client', async () => {
    prisma.post.updateMany.mockResolvedValue({ count: 1 });

    await service.remove('post-id', 'owner-id');

    expect(prisma.post.updateMany).toHaveBeenCalledWith({
      where: { id: 'post-id', anonymousId: 'owner-id', deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
    expect(prisma.post.findUnique).not.toHaveBeenCalled();
  });

  it('treats a repeated owner deletion as success', async () => {
    prisma.post.updateMany.mockResolvedValue({ count: 0 });
    prisma.post.findUnique.mockResolvedValue({
      anonymousId: 'owner-id',
      deletedAt: new Date(),
    });

    await expect(service.remove('post-id', 'owner-id')).resolves.toBeUndefined();
  });

  it('does not disclose or delete a post owned by another anonymous client', async () => {
    prisma.post.updateMany.mockResolvedValue({ count: 0 });
    prisma.post.findUnique.mockResolvedValue({
      anonymousId: 'different-owner',
      deletedAt: null,
    });

    await expect(service.remove('post-id', 'owner-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
