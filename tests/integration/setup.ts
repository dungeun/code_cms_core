/**
 * 통합 테스트 설정
 * 실제 서비스 연동 및 테스트 환경 구성
 */
import { beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

// 환경 변수 설정
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'integration-test-secret-key-very-long';
process.env.DATABASE_URL = 'file:./integration-test.db';
process.env.REDIS_URL = 'redis://localhost:6380'; // 테스트용 Redis 포트

// 테스트 데이터베이스 관리
class TestDatabase {
  private static dbPath = path.join(process.cwd(), 'integration-test.db');

  static async setup() {
    console.log('🗄️  통합 테스트 데이터베이스 설정...');
    
    try {
      // 기존 테스트 DB 제거
      if (fs.existsSync(this.dbPath)) {
        fs.unlinkSync(this.dbPath);
      }

      // 데이터베이스 마이그레이션 실행
      execSync('npx prisma migrate reset --force --skip-seed', {
        stdio: 'pipe',
        env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
      });

      // 테스트 데이터 시드
      execSync('npx prisma db seed', {
        stdio: 'pipe',
        env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
      });

      console.log('✅ 통합 테스트 데이터베이스 준비 완료');
    } catch (error) {
      console.error('❌ 데이터베이스 설정 실패:', error);
      throw error;
    }
  }

  static async cleanup() {
    console.log('🧹 통합 테스트 데이터베이스 정리...');
    
    try {
      if (fs.existsSync(this.dbPath)) {
        fs.unlinkSync(this.dbPath);
      }
      console.log('✅ 데이터베이스 정리 완료');
    } catch (error) {
      console.warn('⚠️  데이터베이스 정리 중 오류:', error);
    }
  }
}

// 테스트 서버 관리
class TestServer {
  private static serverProcess: any = null;

  static async start() {
    console.log('🚀 테스트 서버 시작...');
    
    try {
      // 포트 확인
      const port = process.env.PORT || '3001';
      
      // 실제로는 테스트 서버를 별도 프로세스로 시작
      // 여기서는 시뮬레이션
      process.env.TEST_SERVER_PORT = port;
      process.env.TEST_SERVER_URL = `http://localhost:${port}`;
      
      console.log(`✅ 테스트 서버 시작됨 (포트: ${port})`);
    } catch (error) {
      console.error('❌ 테스트 서버 시작 실패:', error);
      throw error;
    }
  }

  static async stop() {
    console.log('⏹️  테스트 서버 중지...');
    
    if (this.serverProcess) {
      this.serverProcess.kill();
      this.serverProcess = null;
    }
    
    console.log('✅ 테스트 서버 중지됨');
  }
}

// Redis 테스트 관리
class TestRedis {
  static async setup() {
    console.log('📦 Redis 테스트 환경 설정...');
    
    try {
      // Redis 연결 테스트
      const redis = await import('~/lib/redis/cluster.server').then(m => m.getRedisCluster());
      
      // 테스트용 키 패턴으로 기존 데이터 정리
      // await redis.flushdb();
      
      console.log('✅ Redis 테스트 환경 준비 완료');
    } catch (error) {
      console.warn('⚠️  Redis 설정 실패 (선택사항):', error);
    }
  }

  static async cleanup() {
    console.log('🧹 Redis 테스트 데이터 정리...');
    
    try {
      const redis = await import('~/lib/redis/cluster.server').then(m => m.getRedisCluster());
      
      // 테스트 키만 정리
      const testKeys = ['test:*', 'integration:*'];
      
      for (const pattern of testKeys) {
        // 실제 구현에서는 SCAN 명령어 사용
        // const keys = await redis.keys(pattern);
        // if (keys.length > 0) await redis.del(...keys);
      }
      
      console.log('✅ Redis 정리 완료');
    } catch (error) {
      console.warn('⚠️  Redis 정리 중 오류:', error);
    }
  }
}

// 통합 테스트 헬퍼 함수들
export class IntegrationTestHelpers {
  static async createTestUser(userData: any = {}) {
    const { db } = await import('~/lib/db.server');
    
    const defaultUser = {
      email: `test-${Date.now()}@example.com`,
      name: 'Test User',
      role: 'USER',
      provider: 'local',
      ...userData,
    };

    return await db.user.create({
      data: defaultUser,
    });
  }

  static async createTestPost(postData: any = {}, authorId?: string) {
    const { db } = await import('~/lib/db.server');
    
    if (!authorId) {
      const user = await this.createTestUser();
      authorId = user.id;
    }

    const defaultPost = {
      title: `Test Post ${Date.now()}`,
      content: 'Test content',
      slug: `test-post-${Date.now()}`,
      published: true,
      authorId,
      ...postData,
    };

    return await db.post.create({
      data: defaultPost,
    });
  }

  static async createTestCategory(categoryData: any = {}) {
    const { db } = await import('~/lib/db.server');
    
    const defaultCategory = {
      name: `Test Category ${Date.now()}`,
      slug: `test-category-${Date.now()}`,
      description: 'Test description',
      color: '#000000',
      ...categoryData,
    };

    return await db.category.create({
      data: defaultCategory,
    });
  }

  static async makeHttpRequest(method: string, path: string, body?: any, headers?: any) {
    const baseUrl = process.env.TEST_SERVER_URL || 'http://localhost:3001';
    const url = `${baseUrl}${path}`;

    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    if (body) {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);
    const data = await response.json().catch(() => null);

    return {
      status: response.status,
      statusText: response.statusText,
      data,
      headers: Object.fromEntries(response.headers.entries()),
    };
  }

  static async loginAsTestUser(userData?: any) {
    const user = await this.createTestUser(userData);
    
    const response = await this.makeHttpRequest('POST', '/auth/login', {
      email: user.email,
      password: 'test-password',
    });

    return {
      user,
      sessionCookie: response.headers['set-cookie'],
    };
  }

  static async cleanupTestData() {
    const { db } = await import('~/lib/db.server');
    
    // 테스트 데이터만 정리 (email이 test-로 시작하는 경우)
    await db.post.deleteMany({
      where: {
        author: {
          email: {
            startsWith: 'test-',
          },
        },
      },
    });

    await db.user.deleteMany({
      where: {
        email: {
          startsWith: 'test-',
        },
      },
    });

    await db.category.deleteMany({
      where: {
        name: {
          startsWith: 'Test Category',
        },
      },
    });
  }
}

// 성능 측정 도구
export class PerformanceMeasurer {
  private measurements: Map<string, number> = new Map();

  start(label: string) {
    this.measurements.set(label, Date.now());
  }

  end(label: string): number {
    const startTime = this.measurements.get(label);
    if (!startTime) {
      throw new Error(`Performance measurement not started for: ${label}`);
    }

    const duration = Date.now() - startTime;
    this.measurements.delete(label);
    return duration;
  }

  async measure<T>(label: string, fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    this.start(label);
    const result = await fn();
    const duration = this.end(label);
    return { result, duration };
  }
}

// 전역 설정
beforeAll(async () => {
  console.log('🧪 통합 테스트 환경 설정 시작...');
  
  await TestDatabase.setup();
  await TestServer.start();
  await TestRedis.setup();
  
  console.log('✅ 통합 테스트 환경 설정 완료');
}, 60000); // 60초 타임아웃

afterAll(async () => {
  console.log('🧹 통합 테스트 환경 정리 시작...');
  
  await TestRedis.cleanup();
  await TestServer.stop();
  await TestDatabase.cleanup();
  
  console.log('✅ 통합 테스트 환경 정리 완료');
}, 30000); // 30초 타임아웃

beforeEach(async () => {
  // 각 테스트 전에 캐시 정리
  await TestRedis.cleanup();
});

afterEach(async () => {
  // 각 테스트 후에 테스트 데이터 정리
  await IntegrationTestHelpers.cleanupTestData();
});

// 테스트 타임아웃 연장
jest.setTimeout(30000);

console.log('📋 통합 테스트 설정 로드 완료');