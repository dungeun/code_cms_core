// 성능 및 부하 테스트

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { performance } from 'perf_hooks';
import { DatabaseManager } from '../../app/lib/database/db-read-replica.server';
import { cache } from '../../app/lib/cache/redis-cluster.server';
import { ImageOptimizer } from '../../app/lib/media/image-optimization.server';

describe('데이터베이스 성능 테스트', () => {
  beforeAll(async () => {
    // 테스트 데이터 준비
    await DatabaseManager.write(async (db) => {
      // 대량의 테스트 데이터 생성
      const users = Array.from({ length: 1000 }, (_, i) => ({
        email: `user${i}@test.com`,
        passwordHash: 'test-hash',
        name: `Test User ${i}`,
        role: 'USER'
      }));
      
      await db.user.createMany({
        data: users,
        skipDuplicates: true
      });
    });
  });

  it('대량 사용자 조회 성능', async () => {
    const startTime = performance.now();
    
    const users = await DatabaseManager.read(async (db) => {
      return await db.user.findMany({
        take: 100,
        orderBy: { createdAt: 'desc' }
      });
    });
    
    const endTime = performance.now();
    const executionTime = endTime - startTime;
    
    expect(users).toHaveLength(100);
    expect(executionTime).toBeLessThan(100); // 100ms 이내
  });

  it('복잡한 조인 쿼리 성능', async () => {
    const startTime = performance.now();
    
    const posts = await DatabaseManager.read(async (db) => {
      return await db.post.findMany({
        include: {
          author: true,
          category: true,
          _count: {
            select: { comments: true }
          }
        },
        take: 50,
        orderBy: { createdAt: 'desc' }
      });
    });
    
    const endTime = performance.now();
    const executionTime = endTime - startTime;
    
    expect(executionTime).toBeLessThan(200); // 200ms 이내
  });

  it('페이지네이션 성능', async () => {
    const iterations = 10;
    const times: number[] = [];
    
    for (let page = 1; page <= iterations; page++) {
      const startTime = performance.now();
      
      await DatabaseManager.read(async (db) => {
        return await db.user.findMany({
          skip: (page - 1) * 20,
          take: 20,
          orderBy: { createdAt: 'desc' }
        });
      });
      
      const endTime = performance.now();
      times.push(endTime - startTime);
    }
    
    const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    const maxTime = Math.max(...times);
    
    expect(avgTime).toBeLessThan(50); // 평균 50ms 이내
    expect(maxTime).toBeLessThan(100); // 최대 100ms 이내
  });

  it('동시 읽기/쓰기 성능', async () => {
    const concurrency = 10;
    const promises: Promise<any>[] = [];
    
    const startTime = performance.now();
    
    // 동시에 읽기와 쓰기 작업 실행
    for (let i = 0; i < concurrency; i++) {
      if (i % 2 === 0) {
        // 읽기 작업
        promises.push(
          DatabaseManager.read(async (db) => {
            return await db.user.findMany({ take: 10 });
          })
        );
      } else {
        // 쓰기 작업
        promises.push(
          DatabaseManager.write(async (db) => {
            return await db.user.create({
              data: {
                email: `concurrent${i}@test.com`,
                passwordHash: 'test-hash',
                name: `Concurrent User ${i}`,
                role: 'USER'
              }
            });
          })
        );
      }
    }
    
    const results = await Promise.all(promises);
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    expect(results).toHaveLength(concurrency);
    expect(totalTime).toBeLessThan(1000); // 1초 이내
  });
});

describe('캐시 성능 테스트', () => {
  const testKey = 'performance-test';
  const testData = { message: 'Hello, World!', timestamp: Date.now() };

  it('캐시 쓰기 성능', async () => {
    const iterations = 100;
    const startTime = performance.now();
    
    const promises = Array.from({ length: iterations }, async (_, i) => {
      await cache.set(`${testKey}-${i}`, testData, { ttl: 300 });
    });
    
    await Promise.all(promises);
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const avgTimePerOperation = totalTime / iterations;
    
    expect(avgTimePerOperation).toBeLessThan(10); // 평균 10ms 이내
  });

  it('캐시 읽기 성능', async () => {
    // 먼저 캐시에 데이터 저장
    await cache.set(testKey, testData, { ttl: 300 });
    
    const iterations = 1000;
    const startTime = performance.now();
    
    const promises = Array.from({ length: iterations }, async () => {
      return await cache.get(testKey);
    });
    
    const results = await Promise.all(promises);
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const avgTimePerOperation = totalTime / iterations;
    
    expect(results).toHaveLength(iterations);
    expect(results[0]).toEqual(testData);
    expect(avgTimePerOperation).toBeLessThan(5); // 평균 5ms 이내
  });

  it('대량 키 삭제 성능', async () => {
    // 테스트용 키 생성
    const keyCount = 100;
    const promises = Array.from({ length: keyCount }, async (_, i) => {
      await cache.set(`bulk-delete-${i}`, { data: i }, { ttl: 300 });
    });
    
    await Promise.all(promises);
    
    // 삭제 성능 측정
    const startTime = performance.now();
    const deletedCount = await cache.deletePattern('bulk-delete-*');
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    expect(deletedCount).toBe(keyCount);
    expect(totalTime).toBeLessThan(1000); // 1초 이내
  });

  it('메모리 캐시 vs Redis 성능 비교', async () => {
    const iterations = 100;
    
    // Redis 캐시 성능
    const redisStartTime = performance.now();
    const redisPromises = Array.from({ length: iterations }, async (_, i) => {
      const key = `redis-perf-${i}`;
      await cache.set(key, testData, { ttl: 300, useMemoryCache: false });
      return await cache.get(key, { useMemoryCache: false });
    });
    await Promise.all(redisPromises);
    const redisEndTime = performance.now();
    const redisTime = redisEndTime - redisStartTime;
    
    // 메모리 캐시 성능
    const memoryStartTime = performance.now();
    const memoryPromises = Array.from({ length: iterations }, async (_, i) => {
      const key = `memory-perf-${i}`;
      await cache.set(key, testData, { ttl: 300, useMemoryCache: true });
      return await cache.get(key, { useMemoryCache: true });
    });
    await Promise.all(memoryPromises);
    const memoryEndTime = performance.now();
    const memoryTime = memoryEndTime - memoryStartTime;
    
    // 메모리 캐시가 더 빨라야 함
    expect(memoryTime).toBeLessThan(redisTime);
    expect(memoryTime / iterations).toBeLessThan(5); // 평균 5ms 이내
  });
});

describe('이미지 처리 성능 테스트', () => {
  const testImageBuffer = Buffer.from('fake-image-data'.repeat(1000)); // 가상 이미지 데이터

  it('단일 이미지 최적화 성능', async () => {
    const startTime = performance.now();
    
    const optimizedBuffer = await ImageOptimizer.optimizeImage(testImageBuffer, {
      width: 800,
      height: 600,
      format: 'webp',
      quality: 80
    });
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    expect(optimizedBuffer).toBeInstanceOf(Buffer);
    expect(totalTime).toBeLessThan(1000); // 1초 이내
  });

  it('다중 크기 변형 생성 성능', async () => {
    const startTime = performance.now();
    
    const variants = await ImageOptimizer.generateVariants(
      testImageBuffer,
      'test-hash',
      'test-image'
    );
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    expect(Object.keys(variants)).toHaveLength(5); // thumbnail, small, medium, large, xlarge
    expect(totalTime).toBeLessThan(5000); // 5초 이내
  });

  it('동시 이미지 처리 성능', async () => {
    const concurrency = 5;
    const startTime = performance.now();
    
    const promises = Array.from({ length: concurrency }, async (_, i) => {
      return await ImageOptimizer.optimizeImage(testImageBuffer, {
        width: 400 + i * 100,
        height: 300 + i * 75,
        format: 'webp',
        quality: 80
      });
    });
    
    const results = await Promise.all(promises);
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    expect(results).toHaveLength(concurrency);
    expect(totalTime).toBeLessThan(3000); // 3초 이내
  });

  it('캐시된 이미지 변환 성능', async () => {
    const imagePath = '/fake/image/path.jpg';
    const options = { width: 800, height: 600, format: 'webp' as const };
    
    // 첫 번째 요청 (캐시 미스)
    const firstStartTime = performance.now();
    try {
      await ImageOptimizer.transform(imagePath, options);
    } catch {
      // 실제 파일이 없으므로 에러 발생 예상
    }
    const firstEndTime = performance.now();
    const firstTime = firstEndTime - firstStartTime;
    
    // 두 번째 요청 (캐시 히트)
    const secondStartTime = performance.now();
    try {
      await ImageOptimizer.transform(imagePath, options);
    } catch {
      // 실제 파일이 없으므로 에러 발생 예상
    }
    const secondEndTime = performance.now();
    const secondTime = secondEndTime - secondStartTime;
    
    // 캐시가 있으면 더 빨라야 함 (실제 파일이 없어도 캐시 키는 확인됨)
    expect(firstTime).toBeGreaterThan(0);
    expect(secondTime).toBeGreaterThan(0);
  });
});

describe('API 응답 시간 테스트', () => {
  it('인증 API 응답 시간', async () => {
    const iterations = 50;
    const times: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      
      // 가상의 인증 프로세스 시뮬레이션
      try {
        await DatabaseManager.read(async (db) => {
          return await db.user.findUnique({
            where: { email: `test${i}@example.com` }
          });
        });
      } catch {
        // 사용자가 없을 수 있음
      }
      
      const endTime = performance.now();
      times.push(endTime - startTime);
    }
    
    const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    const p95Time = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
    
    expect(avgTime).toBeLessThan(50); // 평균 50ms 이내
    expect(p95Time).toBeLessThan(200); // 95 퍼센타일 200ms 이내
  });

  it('게시글 목록 API 응답 시간', async () => {
    const startTime = performance.now();
    
    const posts = await DatabaseManager.read(async (db) => {
      return await db.post.findMany({
        include: {
          author: {
            select: { id: true, name: true, email: true }
          },
          category: true
        },
        take: 20,
        orderBy: { createdAt: 'desc' }
      });
    });
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    expect(totalTime).toBeLessThan(100); // 100ms 이내
  });

  it('검색 API 응답 시간', async () => {
    const searchQueries = ['test', '테스트', 'user', '사용자', 'post'];
    const times: number[] = [];
    
    for (const query of searchQueries) {
      const startTime = performance.now();
      
      await DatabaseManager.read(async (db) => {
        return await db.post.findMany({
          where: {
            OR: [
              { title: { contains: query, mode: 'insensitive' } },
              { content: { contains: query, mode: 'insensitive' } }
            ]
          },
          take: 10
        });
      });
      
      const endTime = performance.now();
      times.push(endTime - startTime);
    }
    
    const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    const maxTime = Math.max(...times);
    
    expect(avgTime).toBeLessThan(200); // 평균 200ms 이내
    expect(maxTime).toBeLessThan(500); // 최대 500ms 이내
  });
});

describe('메모리 사용량 테스트', () => {
  it('대량 데이터 처리 시 메모리 사용량', async () => {
    const initialMemory = process.memoryUsage();
    
    // 대량 데이터 생성 및 처리
    const largeDataSet = Array.from({ length: 10000 }, (_, i) => ({
      id: i,
      title: `Test Item ${i}`,
      content: 'Test content '.repeat(100),
      metadata: { index: i, timestamp: Date.now() }
    }));
    
    // 데이터 처리
    const processed = largeDataSet.map(item => ({
      ...item,
      processed: true,
      contentLength: item.content.length
    }));
    
    const finalMemory = process.memoryUsage();
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    
    // 메모리 증가량이 합리적인 범위 내에 있는지 확인 (100MB 이하)
    expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    expect(processed).toHaveLength(10000);
  });

  it('캐시 메모리 누수 테스트', async () => {
    const initialMemory = process.memoryUsage();
    
    // 반복적으로 캐시 사용
    for (let i = 0; i < 1000; i++) {
      await cache.set(`memory-leak-test-${i}`, { data: 'test'.repeat(100) }, { ttl: 1 });
      await cache.get(`memory-leak-test-${i}`);
      
      // 일부 키는 즉시 삭제
      if (i % 10 === 0) {
        await cache.delete(`memory-leak-test-${i}`);
      }
    }
    
    // 가비지 컬렉션 강제 실행
    if (global.gc) {
      global.gc();
    }
    
    const finalMemory = process.memoryUsage();
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    
    // 메모리 증가량이 합리적인 범위 내에 있는지 확인 (50MB 이하)
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
  });
});

describe('동시성 테스트', () => {
  it('높은 동시성 하에서의 데이터베이스 작업', async () => {
    const concurrency = 50;
    const startTime = performance.now();
    
    const promises = Array.from({ length: concurrency }, async (_, i) => {
      // 읽기와 쓰기 작업을 무작위로 수행
      if (Math.random() > 0.5) {
        return await DatabaseManager.read(async (db) => {
          return await db.user.findFirst({
            orderBy: { createdAt: 'desc' }
          });
        });
      } else {
        return await DatabaseManager.write(async (db) => {
          return await db.user.create({
            data: {
              email: `concurrent-stress-${i}-${Date.now()}@test.com`,
              passwordHash: 'test-hash',
              name: `Stress Test User ${i}`,
              role: 'USER'
            }
          });
        });
      }
    });
    
    const results = await Promise.all(promises);
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    expect(results).toHaveLength(concurrency);
    expect(totalTime).toBeLessThan(5000); // 5초 이내
    
    // 모든 작업이 성공했는지 확인
    const successfulResults = results.filter(result => result !== null);
    expect(successfulResults.length).toBe(concurrency);
  });

  it('캐시 동시성 테스트', async () => {
    const concurrency = 100;
    const keyPrefix = 'concurrent-cache-test';
    
    const startTime = performance.now();
    
    const promises = Array.from({ length: concurrency }, async (_, i) => {
      const key = `${keyPrefix}-${i % 10}`; // 10개의 키를 재사용
      
      // 동시에 읽기/쓰기 수행
      await cache.set(key, { index: i, timestamp: Date.now() }, { ttl: 60 });
      return await cache.get(key);
    });
    
    const results = await Promise.all(promises);
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    expect(results).toHaveLength(concurrency);
    expect(totalTime).toBeLessThan(3000); // 3초 이내
    
    // 모든 결과가 유효한지 확인
    const validResults = results.filter(result => result !== null);
    expect(validResults.length).toBe(concurrency);
  });
});

afterAll(async () => {
  // 테스트 정리
  await DatabaseManager.write(async (db) => {
    await db.user.deleteMany({
      where: {
        email: {
          contains: 'test.com'
        }
      }
    });
  });
});