import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/database/prisma.service.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let prismaPost: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    prismaPost = {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
    };
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: vi.fn(),
        $disconnect: vi.fn(),
        post: prismaPost,
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('creates an HttpOnly anonymous identity cookie without returning the ID', async () => {
    const response = await request(app.getHttpServer()).get('/').expect(200);
    const setCookie = response.headers['set-cookie']?.[0];

    expect(setCookie).toMatch(/^anonymous_id=[0-9a-f-]+;/i);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).toContain('Max-Age=31536000');
    expect(response.text).toBe('Hello World!');
  });

  it('reuses a valid anonymous identity cookie', async () => {
    const anonymousId = '550e8400-e29b-41d4-a716-446655440000';

    const response = await request(app.getHttpServer())
      .get('/')
      .set('Cookie', `anonymous_id=${anonymousId}`)
      .expect(200);

    expect(response.headers['set-cookie']).toBeUndefined();
    expect(response.text).not.toContain(anonymousId);
  });

  it('replaces malformed anonymous identity cookies', async () => {
    const response = await request(app.getHttpServer())
      .get('/')
      .set('Cookie', 'anonymous_id=invalid')
      .expect(200);
    const setCookie = response.headers['set-cookie']?.[0];

    expect(setCookie).toMatch(/^anonymous_id=[0-9a-f-]+;/i);
    expect(setCookie).not.toContain('anonymous_id=invalid');
  });

  it('creates posts using the cookie identity, not a body identity', async () => {
    const anonymousId = '550e8400-e29b-41d4-a716-446655440000';
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    prismaPost.create.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000001',
      content: 'hello',
      createdAt,
      updatedAt: createdAt,
    });

    const response = await request(app.getHttpServer())
      .post('/posts')
      .set('Cookie', `anonymous_id=${anonymousId}`)
      .send({ content: '  hello  ' })
      .expect(201);

    expect(prismaPost.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { anonymousId, content: 'hello' },
      }),
    );
    expect(response.body).not.toHaveProperty('anonymousId');
  });

  it('rejects client-supplied anonymous IDs and whitespace-only content', async () => {
    const anonymousId = '550e8400-e29b-41d4-a716-446655440000';

    await request(app.getHttpServer())
      .post('/posts')
      .set('Cookie', `anonymous_id=${anonymousId}`)
      .send({ content: 'valid', anonymousId })
      .expect(400);
    await request(app.getHttpServer())
      .post('/posts')
      .set('Cookie', `anonymous_id=${anonymousId}`)
      .send({ content: '   ' })
      .expect(400);

    expect(prismaPost.create).not.toHaveBeenCalled();
  });

  it('serves a bounded active-post page', async () => {
    await request(app.getHttpServer()).get('/posts?limit=25').expect(200);

    expect(prismaPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null },
        take: 26,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
  });

  it('returns a public post with like and visible-comment counts', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    prismaPost.findFirst.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000001',
      content: 'hello',
      createdAt,
      updatedAt: createdAt,
      _count: { likes: 4, comments: 2 },
    });

    const response = await request(app.getHttpServer())
      .get('/posts/00000000-0000-4000-8000-000000000001')
      .expect(200);

    expect(prismaPost.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: '00000000-0000-4000-8000-000000000001',
          deletedAt: null,
        },
      }),
    );
    expect(response.body).toMatchObject({ likeCount: 4, commentCount: 2 });
    expect(response.body).not.toHaveProperty('anonymousId');
  });

  it('deletes a post using the request identity and returns no body', async () => {
    const anonymousId = '550e8400-e29b-41d4-a716-446655440000';
    prismaPost.updateMany.mockResolvedValue({ count: 1 });

    await request(app.getHttpServer())
      .delete('/posts/00000000-0000-4000-8000-000000000001')
      .set('Cookie', `anonymous_id=${anonymousId}`)
      .expect(204);

    expect(prismaPost.updateMany).toHaveBeenCalledWith({
      where: {
        id: '00000000-0000-4000-8000-000000000001',
        anonymousId,
        deletedAt: null,
      },
      data: { deletedAt: expect.any(Date) },
    });
  });

  afterEach(async () => {
    await app.close();
  });
});
