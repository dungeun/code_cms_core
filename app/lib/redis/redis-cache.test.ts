/**
 * Redis 캐시 구현체 테스트
 * 모든 CacheInterface 메서드 및 Redis 전용 기능 테스트
 */

import { RedisCache } from './redis-cache';

/**
 * Redis 캐시 테스트 스위트
 * 실제 테스트 프레임워크 없이 간단한 검증 함수로 구현
 */
export async function testRedisCache() {
  console.log('🧪 Redis 캐시 테스트 시작...\n');
  
  const cache = new RedisCache('test');
  let testsPassed = 0;
  let testsFailed = 0;

  // 테스트 헬퍼 함수
  const assert = (condition: boolean, testName: string) => {
    if (condition) {
      console.log(`✅ ${testName}`);
      testsPassed++;
    } else {
      console.error(`❌ ${testName}`);
      testsFailed++;
    }
  };

  const assertEqual = (actual: any, expected: any, testName: string) => {
    const condition = JSON.stringify(actual) === JSON.stringify(expected);
    assert(condition, `${testName} (Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)})`);
  };

  try {
    // 1. 기본 set/get 테스트
    await cache.set('test-key', { value: 'test-value' });
    const getValue = await cache.get('test-key');
    assertEqual(getValue, { value: 'test-value' }, 'Basic set/get');

    // 2. TTL 테스트
    await cache.set('ttl-key', 'ttl-value', 2); // 2초 TTL
    const ttlValue1 = await cache.get('ttl-key');
    assertEqual(ttlValue1, 'ttl-value', 'TTL key exists immediately');
    
    // 3초 후 확인 (TTL 만료)
    await new Promise(resolve => setTimeout(resolve, 3000));
    const ttlValue2 = await cache.get('ttl-key');
    assertEqual(ttlValue2, null, 'TTL key expired after timeout');

    // 3. has 메서드 테스트
    await cache.set('exists-key', 'exists');
    const exists = await cache.has('exists-key');
    const notExists = await cache.has('not-exists-key');
    assert(exists === true, 'has() returns true for existing key');
    assert(notExists === false, 'has() returns false for non-existing key');

    // 4. del 메서드 테스트
    await cache.set('delete-key', 'to-delete');
    await cache.del('delete-key');
    const deleted = await cache.get('delete-key');
    assertEqual(deleted, null, 'Key deleted successfully');

    // 5. expire 메서드 테스트
    await cache.set('expire-key', 'expire-value');
    await cache.expire('expire-key', 1); // 1초로 TTL 설정
    await new Promise(resolve => setTimeout(resolve, 2000));
    const expiredValue = await cache.get('expire-key');
    assertEqual(expiredValue, null, 'expire() sets TTL correctly');

    // 6. keys 패턴 매칭 테스트
    await cache.set('pattern:1', 'value1');
    await cache.set('pattern:2', 'value2');
    await cache.set('other:1', 'value3');
    const patternKeys = await cache.keys('pattern:*');
    assert(patternKeys.includes('pattern:1'), 'Pattern matching finds pattern:1');
    assert(patternKeys.includes('pattern:2'), 'Pattern matching finds pattern:2');
    assert(!patternKeys.includes('other:1'), 'Pattern matching excludes other:1');

    // 7. 원자적 증가/감소 테스트
    await cache.set('counter', '0');
    const incr1 = await cache.incr('counter');
    assertEqual(incr1, 1, 'incr() increments to 1');
    const incr2 = await cache.incr('counter', 5);
    assertEqual(incr2, 6, 'incr(5) increments by 5');
    const decr1 = await cache.decr('counter');
    assertEqual(decr1, 5, 'decr() decrements to 5');

    // 8. 해시 연산 테스트
    await cache.hset('hash-key', 'field1', { nested: 'value' });
    await cache.hset('hash-key', 'field2', 'simple-value');
    const hget1 = await cache.hget('hash-key', 'field1');
    assertEqual(hget1, { nested: 'value' }, 'hget() retrieves complex object');
    const hgetall = await cache.hgetall('hash-key');
    assert(hgetall !== null && hgetall.field1?.nested === 'value', 'hgetall() retrieves all fields');

    // 9. 리스트 연산 테스트
    await cache.lpush('list-key', 'item1', 'item2', 'item3');
    const lrange = await cache.lrange('list-key', 0, -1);
    assert(Array.isArray(lrange) && lrange.length === 3, 'lpush() and lrange() work correctly');
    const rpopValue = await cache.rpop('list-key');
    assertEqual(rpopValue, 'item1', 'rpop() returns last item');

    // 10. 집합 연산 테스트
    await cache.sadd('set-key', 'member1', 'member2');
    const isMember = await cache.sismember('set-key', 'member1');
    assert(isMember === true, 'sismember() finds existing member');
    const members = await cache.smembers('set-key');
    assert(Array.isArray(members) && members.length === 2, 'smembers() returns all members');

    // 11. mget/mset 테스트
    await cache.mset({
      'multi1': 'value1',
      'multi2': { complex: 'value2' },
      'multi3': 123
    });
    const multiGet = await cache.mget(['multi1', 'multi2', 'multi3', 'multi-not-exists']);
    assertEqual(multiGet[0], 'value1', 'mget() retrieves first value');
    assertEqual(multiGet[1], { complex: 'value2' }, 'mget() retrieves complex value');
    assertEqual(multiGet[2], 123, 'mget() retrieves number');
    assertEqual(multiGet[3], null, 'mget() returns null for non-existing');

    // 12. setnx 테스트
    const setnx1 = await cache.setnx('unique-key', 'first-value');
    assert(setnx1 === true, 'setnx() sets non-existing key');
    const setnx2 = await cache.setnx('unique-key', 'second-value');
    assert(setnx2 === false, 'setnx() fails for existing key');
    const uniqueValue = await cache.get('unique-key');
    assertEqual(uniqueValue, 'first-value', 'setnx() preserves first value');

    // 13. TTL 조회 테스트
    await cache.set('ttl-check', 'value', 10);
    const ttl = await cache.ttl('ttl-check');
    assert(ttl > 0 && ttl <= 10, `TTL query returns correct value: ${ttl}`);

    // 14. 통계 조회 테스트
    const stats = await cache.getStats();
    assert(stats.keyCount > 0, `Stats show key count: ${stats.keyCount}`);
    assert(stats.memoryUsage >= 0, `Stats show memory usage: ${stats.memoryUsage}`);

    // 15. clear 테스트 (마지막에 실행)
    await cache.clear();
    const afterClear = await cache.keys('*');
    assertEqual(afterClear.length, 0, 'clear() removes all keys');

  } catch (error) {
    console.error('테스트 실행 중 오류:', error);
    testsFailed++;
  }

  // 테스트 결과 출력
  console.log('\n📊 테스트 결과:');
  console.log(`✅ 성공: ${testsPassed}`);
  console.log(`❌ 실패: ${testsFailed}`);
  console.log(`📈 성공률: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);

  return {
    passed: testsPassed,
    failed: testsFailed,
    total: testsPassed + testsFailed
  };
}

/**
 * 성능 테스트
 */
export async function performanceTest() {
  console.log('\n⚡ Redis 캐시 성능 테스트 시작...\n');
  
  const cache = new RedisCache('perf-test');
  const iterations = 10000;
  
  // 쓰기 성능 테스트
  const writeStart = Date.now();
  for (let i = 0; i < iterations; i++) {
    await cache.set(`perf-key-${i}`, { index: i, data: `value-${i}` });
  }
  const writeTime = Date.now() - writeStart;
  const writeOps = (iterations / (writeTime / 1000)).toFixed(0);
  console.log(`📝 쓰기 성능: ${iterations}개 키 in ${writeTime}ms (${writeOps} ops/sec)`);

  // 읽기 성능 테스트
  const readStart = Date.now();
  for (let i = 0; i < iterations; i++) {
    await cache.get(`perf-key-${i}`);
  }
  const readTime = Date.now() - readStart;
  const readOps = (iterations / (readTime / 1000)).toFixed(0);
  console.log(`📖 읽기 성능: ${iterations}개 키 in ${readTime}ms (${readOps} ops/sec)`);

  // 패턴 검색 성능 테스트
  const searchStart = Date.now();
  const foundKeys = await cache.keys('perf-key-*');
  const searchTime = Date.now() - searchStart;
  console.log(`🔍 패턴 검색 성능: ${foundKeys.length}개 키 발견 in ${searchTime}ms`);

  // 원자적 연산 성능 테스트
  const atomicStart = Date.now();
  for (let i = 0; i < iterations; i++) {
    await cache.incr('perf-counter');
  }
  const atomicTime = Date.now() - atomicStart;
  const atomicOps = (iterations / (atomicTime / 1000)).toFixed(0);
  console.log(`⚛️ 원자적 연산 성능: ${iterations}개 증가 in ${atomicTime}ms (${atomicOps} ops/sec)`);

  // 정리
  await cache.clear();
  
  console.log('\n✨ 성능 테스트 완료!');
  
  // 10,000 req/s 목표 달성 여부
  const targetOps = 10000;
  if (parseInt(readOps) >= targetOps && parseInt(writeOps) >= targetOps) {
    console.log(`🎯 목표 달성: 10,000+ ops/sec 처리 가능!`);
  } else {
    console.log(`⚠️ 성능 최적화 필요: 목표 10,000 ops/sec`);
  }

  return {
    writeOps: parseInt(writeOps),
    readOps: parseInt(readOps),
    atomicOps: parseInt(atomicOps),
    targetMet: parseInt(readOps) >= targetOps && parseInt(writeOps) >= targetOps
  };
}

// 테스트 실행 (직접 실행 시)
if (require.main === module) {
  (async () => {
    await testRedisCache();
    await performanceTest();
    process.exit(0);
  })();
}