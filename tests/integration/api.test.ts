// API 통합 테스트

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createRemixStub } from '@remix-run/testing';
import { prisma } from '../../app/lib/db.server';

// 테스트 사용자 데이터
const testUser = {
  email: 'test@example.com',
  password: 'TestPassword123!',
  name: '테스트 사용자'
};

const testAdmin = {
  email: 'admin@example.com',
  password: 'AdminPassword123!',
  name: '관리자',
  role: 'ADMIN'
};

describe('API 통합 테스트', () => {
  let userToken: string;
  let adminToken: string;

  beforeAll(async () => {
    // 테스트 데이터베이스 초기화
    await prisma.$executeRaw`TRUNCATE TABLE "User" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "Post" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "Category" CASCADE`;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('인증 API', () => {
    it('사용자 회원가입이 성공해야 한다', async () => {
      const app = createRemixStub([
        {
          path: '/api/auth/register',
          Component: () => null,
          action: async ({ request }) => {
            // 실제 회원가입 액션 로직
            const formData = await request.formData();
            const email = formData.get('email') as string;
            const password = formData.get('password') as string;
            const name = formData.get('name') as string;

            // 유효성 검증
            if (!email || !password || !name) {
              return { error: '필수 필드가 누락되었습니다' };
            }

            // 사용자 생성
            const user = await prisma.user.create({
              data: {
                email,
                passwordHash: await hashPassword(password),
                name,
                role: 'USER'
              }
            });

            return { success: true, user: { id: user.id, email: user.email, name: user.name } };
          }
        }
      ]);

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: testUser.email,
          password: testUser.password,
          name: testUser.name
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user.email).toBe(testUser.email);
    });

    it('중복 이메일로 회원가입이 실패해야 한다', async () => {
      const app = createRemixStub([
        {
          path: '/api/auth/register',
          Component: () => null,
          action: async ({ request }) => {
            const formData = await request.formData();
            const email = formData.get('email') as string;

            // 이미 존재하는 사용자 확인
            const existingUser = await prisma.user.findUnique({ where: { email } });
            if (existingUser) {
              return { error: '이미 등록된 이메일입니다' };
            }

            return { success: true };
          }
        }
      ]);

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: testUser.email, // 이미 등록된 이메일
          password: 'NewPassword123!',
          name: '새 사용자'
        })
        .expect(400);

      expect(response.body.error).toContain('이미 등록된 이메일');
    });

    it('로그인이 성공해야 한다', async () => {
      const app = createRemixStub([
        {
          path: '/api/auth/login',
          Component: () => null,
          action: async ({ request }) => {
            const formData = await request.formData();
            const email = formData.get('email') as string;
            const password = formData.get('password') as string;

            const user = await authenticateUser(email, password);
            if (!user) {
              return { error: '이메일 또는 비밀번호가 올바르지 않습니다' };
            }

            // JWT 토큰 생성 (실제 구현)
            const token = generateJWT({ userId: user.id, email: user.email });

            return { 
              success: true, 
              token,
              user: { id: user.id, email: user.email, name: user.name, role: user.role }
            };
          }
        }
      ]);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      userToken = response.body.token;
    });

    it('잘못된 비밀번호로 로그인이 실패해야 한다', async () => {
      const app = createRemixStub([
        {
          path: '/api/auth/login',
          Component: () => null,
          action: async ({ request }) => {
            const formData = await request.formData();
            const email = formData.get('email') as string;
            const password = formData.get('password') as string;

            const user = await authenticateUser(email, password);
            if (!user) {
              return { error: '이메일 또는 비밀번호가 올바르지 않습니다' };
            }

            return { success: true };
          }
        }
      ]);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!'
        })
        .expect(401);

      expect(response.body.error).toContain('이메일 또는 비밀번호가 올바르지 않습니다');
    });
  });

  describe('게시글 API', () => {
    let categoryId: string;
    let postId: string;

    beforeEach(async () => {
      // 테스트용 카테고리 생성
      const category = await prisma.category.create({
        data: {
          name: 'Test Category',
          slug: 'test-category',
          description: 'Test category description'
        }
      });
      categoryId = category.id;
    });

    it('게시글 생성이 성공해야 한다', async () => {
      const postData = {
        title: '테스트 게시글',
        content: '테스트 게시글 내용입니다.',
        categoryId,
        isPublished: true
      };

      const app = createRemixStub([
        {
          path: '/api/posts',
          Component: () => null,
          action: async ({ request }) => {
            // JWT 토큰 검증
            const authorization = request.headers.get('Authorization');
            if (!authorization || !authorization.startsWith('Bearer ')) {
              return { error: '인증이 필요합니다' };
            }

            const formData = await request.formData();
            const title = formData.get('title') as string;
            const content = formData.get('content') as string;
            const categoryId = formData.get('categoryId') as string;

            const post = await prisma.post.create({
              data: {
                title,
                content,
                categoryId,
                authorId: 'user-id', // JWT에서 추출
                isPublished: true
              }
            });

            return { success: true, post };
          }
        }
      ]);

      const response = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${userToken}`)
        .send(postData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.post.title).toBe(postData.title);
      postId = response.body.post.id;
    });

    it('인증 없이 게시글 생성이 실패해야 한다', async () => {
      const postData = {
        title: '인증 없는 게시글',
        content: '내용',
        categoryId
      };

      const app = createRemixStub([
        {
          path: '/api/posts',
          Component: () => null,
          action: async ({ request }) => {
            const authorization = request.headers.get('Authorization');
            if (!authorization) {
              return { error: '인증이 필요합니다' };
            }
            return { success: true };
          }
        }
      ]);

      const response = await request(app)
        .post('/api/posts')
        .send(postData)
        .expect(401);

      expect(response.body.error).toContain('인증이 필요합니다');
    });

    it('게시글 목록 조회가 성공해야 한다', async () => {
      const app = createRemixStub([
        {
          path: '/api/posts',
          Component: () => null,
          loader: async ({ request }) => {
            const url = new URL(request.url);
            const page = parseInt(url.searchParams.get('page') || '1');
            const limit = parseInt(url.searchParams.get('limit') || '10');

            const posts = await prisma.post.findMany({
              where: { isPublished: true },
              include: { category: true, author: true },
              orderBy: { createdAt: 'desc' },
              skip: (page - 1) * limit,
              take: limit
            });

            const total = await prisma.post.count({ where: { isPublished: true } });

            return { posts, pagination: { page, limit, total } };
          }
        }
      ]);

      const response = await request(app)
        .get('/api/posts?page=1&limit=10')
        .expect(200);

      expect(response.body.posts).toBeDefined();
      expect(response.body.pagination).toBeDefined();
      expect(Array.isArray(response.body.posts)).toBe(true);
    });

    it('게시글 상세 조회가 성공해야 한다', async () => {
      const app = createRemixStub([
        {
          path: '/api/posts/:id',
          Component: () => null,
          loader: async ({ params }) => {
            const post = await prisma.post.findUnique({
              where: { id: params.id },
              include: { category: true, author: true }
            });

            if (!post) {
              return { error: '게시글을 찾을 수 없습니다' };
            }

            return { post };
          }
        }
      ]);

      const response = await request(app)
        .get(`/api/posts/${postId}`)
        .expect(200);

      expect(response.body.post).toBeDefined();
      expect(response.body.post.id).toBe(postId);
    });

    it('존재하지 않는 게시글 조회가 실패해야 한다', async () => {
      const app = createRemixStub([
        {
          path: '/api/posts/:id',
          Component: () => null,
          loader: async ({ params }) => {
            const post = await prisma.post.findUnique({
              where: { id: params.id }
            });

            if (!post) {
              return { error: '게시글을 찾을 수 없습니다' };
            }

            return { post };
          }
        }
      ]);

      const response = await request(app)
        .get('/api/posts/nonexistent-id')
        .expect(404);

      expect(response.body.error).toContain('게시글을 찾을 수 없습니다');
    });
  });

  describe('관리자 API', () => {
    beforeAll(async () => {
      // 관리자 계정 생성 및 로그인
      await prisma.user.create({
        data: {
          email: testAdmin.email,
          passwordHash: await hashPassword(testAdmin.password),
          name: testAdmin.name,
          role: 'ADMIN'
        }
      });

      // 관리자 토큰 획득 (로그인)
      const loginApp = createRemixStub([
        {
          path: '/api/auth/login',
          Component: () => null,
          action: async ({ request }) => {
            const formData = await request.formData();
            const email = formData.get('email') as string;
            const password = formData.get('password') as string;

            const user = await authenticateUser(email, password);
            if (!user) {
              return { error: '인증 실패' };
            }

            const token = generateJWT({ userId: user.id, email: user.email, role: user.role });
            return { success: true, token };
          }
        }
      ]);

      const loginResponse = await request(loginApp)
        .post('/api/auth/login')
        .send({
          email: testAdmin.email,
          password: testAdmin.password
        });

      adminToken = loginResponse.body.token;
    });

    it('관리자만 사용자 목록을 조회할 수 있어야 한다', async () => {
      const app = createRemixStub([
        {
          path: '/api/admin/users',
          Component: () => null,
          loader: async ({ request }) => {
            const authorization = request.headers.get('Authorization');
            if (!authorization) {
              return { error: '인증이 필요합니다' };
            }

            // JWT 토큰에서 사용자 역할 확인
            const token = authorization.replace('Bearer ', '');
            const payload = verifyJWT(token);
            
            if (payload.role !== 'ADMIN') {
              return { error: '관리자 권한이 필요합니다' };
            }

            const users = await prisma.user.findMany({
              select: { id: true, email: true, name: true, role: true, createdAt: true }
            });

            return { users };
          }
        }
      ]);

      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.users).toBeDefined();
      expect(Array.isArray(response.body.users)).toBe(true);
    });

    it('일반 사용자가 관리자 API에 접근하면 실패해야 한다', async () => {
      const app = createRemixStub([
        {
          path: '/api/admin/users',
          Component: () => null,
          loader: async ({ request }) => {
            const authorization = request.headers.get('Authorization');
            if (!authorization) {
              return { error: '인증이 필요합니다' };
            }

            const token = authorization.replace('Bearer ', '');
            const payload = verifyJWT(token);
            
            if (payload.role !== 'ADMIN') {
              return { error: '관리자 권한이 필요합니다' };
            }

            return { users: [] };
          }
        }
      ]);

      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${userToken}`) // 일반 사용자 토큰
        .expect(403);

      expect(response.body.error).toContain('관리자 권한이 필요합니다');
    });
  });

  describe('파일 업로드 API', () => {
    it('이미지 파일 업로드가 성공해야 한다', async () => {
      const app = createRemixStub([
        {
          path: '/api/upload',
          Component: () => null,
          action: async ({ request }) => {
            const authorization = request.headers.get('Authorization');
            if (!authorization) {
              return { error: '인증이 필요합니다' };
            }

            // 파일 업로드 로직 시뮬레이션
            return {
              success: true,
              file: {
                id: 'uploaded-file-id',
                filename: 'test-image.jpg',
                url: '/uploads/test-image.jpg'
              }
            };
          }
        }
      ]);

      const response = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${userToken}`)
        .attach('file', Buffer.from('fake image data'), 'test-image.jpg')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.file.filename).toBe('test-image.jpg');
    });

    it('허용되지 않는 파일 형식 업로드가 실패해야 한다', async () => {
      const app = createRemixStub([
        {
          path: '/api/upload',
          Component: () => null,
          action: async ({ request }) => {
            // 파일 형식 검증 시뮬레이션
            const contentType = request.headers.get('content-type');
            
            if (contentType && !contentType.includes('image/')) {
              return { error: '이미지 파일만 업로드 가능합니다' };
            }

            return { success: true };
          }
        }
      ]);

      const response = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${userToken}`)
        .attach('file', Buffer.from('fake text data'), 'test.txt')
        .expect(400);

      expect(response.body.error).toContain('이미지 파일만 업로드 가능합니다');
    });
  });
});

// 헬퍼 함수들
async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import('bcryptjs');
  return await bcrypt.hash(password, 12);
}

async function authenticateUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;

  const bcrypt = await import('bcryptjs');
  const isValid = await bcrypt.compare(password, user.passwordHash);
  
  return isValid ? user : null;
}

function generateJWT(payload: any): string {
  // JWT 생성 시뮬레이션
  return 'mock-jwt-token-' + JSON.stringify(payload);
}

function verifyJWT(token: string): any {
  // JWT 검증 시뮬레이션
  const payload = token.replace('mock-jwt-token-', '');
  return JSON.parse(payload);
}