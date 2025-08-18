/**
 * DB 세션을 Redis로 마이그레이션하는 스크립트
 * 기존 세션 데이터를 보존하면서 Redis로 이전
 */

import { db } from '~/utils/db.server';
import { migrateDbSessionsToRedis, getSessionManager } from './session.server';

/**
 * 마이그레이션 실행
 */
export async function runSessionMigration() {
  console.log('🔄 세션 마이그레이션 시작...\n');
  
  try {
    // 1. 모든 활성 DB 세션 조회
    const dbSessions = await db.session.findMany({
      where: {
        expiresAt: {
          gt: new Date(), // 만료되지 않은 세션만
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    
    console.log(`📊 마이그레이션 대상 세션: ${dbSessions.length}개\n`);
    
    if (dbSessions.length === 0) {
      console.log('✅ 마이그레이션할 세션이 없습니다.');
      return;
    }
    
    // 2. Redis로 마이그레이션
    const results = await migrateDbSessionsToRedis(dbSessions);
    
    console.log('\n📈 마이그레이션 결과:');
    console.log(`✅ 성공: ${results.migrated}개`);
    console.log(`❌ 실패: ${results.failed}개`);
    
    if (results.errors.length > 0) {
      console.log('\n⚠️ 오류 상세:');
      results.errors.forEach(error => console.error(`  - ${error}`));
    }
    
    // 3. 마이그레이션 성공한 DB 세션 삭제 옵션
    if (results.migrated > 0) {
      console.log('\n🗑️ DB 세션 정리 옵션:');
      console.log('마이그레이션이 완료된 DB 세션을 삭제하시겠습니까?');
      console.log('(프로덕션 환경에서는 Redis가 안정적으로 동작하는지 확인 후 삭제하세요)');
      
      // 환경 변수로 자동 삭제 여부 결정
      if (process.env.AUTO_DELETE_MIGRATED_SESSIONS === 'true') {
        const deletedCount = await cleanupMigratedSessions(dbSessions);
        console.log(`✅ ${deletedCount}개의 DB 세션이 삭제되었습니다.`);
      } else {
        console.log('ℹ️ DB 세션이 보존되었습니다. 수동으로 삭제하세요.');
      }
    }
    
    // 4. Redis 세션 통계 출력
    const sessionManager = getSessionManager();
    const stats = await sessionManager.getSessionStats();
    
    console.log('\n📊 Redis 세션 통계:');
    console.log(`  총 세션: ${stats.totalSessions}`);
    console.log(`  활성 세션: ${stats.activeSessions}`);
    console.log(`  만료된 세션: ${stats.expiredSessions}`);
    
    console.log('\n✨ 세션 마이그레이션 완료!');
    
  } catch (error) {
    console.error('❌ 마이그레이션 실패:', error);
    throw error;
  }
}

/**
 * 마이그레이션된 DB 세션 삭제
 */
async function cleanupMigratedSessions(
  sessions: Array<{ id: string; token: string }>
): Promise<number> {
  const deletePromises = sessions.map(session =>
    db.session.delete({
      where: { id: session.id },
    }).catch(error => {
      console.error(`세션 ${session.id} 삭제 실패:`, error);
      return null;
    })
  );
  
  const results = await Promise.all(deletePromises);
  return results.filter(r => r !== null).length;
}

/**
 * 세션 동기화 검증
 * Redis와 DB 세션 간 일관성 확인
 */
export async function validateSessionSync() {
  console.log('🔍 세션 동기화 검증 시작...\n');
  
  // DB 세션 조회
  const dbSessions = await db.session.findMany({
    where: {
      expiresAt: {
        gt: new Date(),
      },
    },
    select: {
      id: true,
      userId: true,
      token: true,
    },
  });
  
  // Redis 세션 조회
  const sessionManager = getSessionManager();
  const redisSessionKeys = await sessionManager.cache.keys('session:*');
  
  console.log(`📊 세션 현황:`);
  console.log(`  DB 세션: ${dbSessions.length}개`);
  console.log(`  Redis 세션: ${redisSessionKeys.length}개`);
  
  // 사용자별 세션 수 비교
  const dbUserSessions = new Map<string, number>();
  for (const session of dbSessions) {
    const count = dbUserSessions.get(session.userId) || 0;
    dbUserSessions.set(session.userId, count + 1);
  }
  
  console.log('\n👥 사용자별 세션 분포:');
  for (const [userId, count] of dbUserSessions.entries()) {
    const redisSessions = await sessionManager.getUserSessions(userId);
    console.log(`  사용자 ${userId}: DB=${count}, Redis=${redisSessions.length}`);
  }
  
  return {
    dbCount: dbSessions.length,
    redisCount: redisSessionKeys.length,
    synced: dbSessions.length === 0 || redisSessionKeys.length > 0,
  };
}

/**
 * 롤백: Redis 세션을 DB로 복원
 * 긴급 상황 시 사용
 */
export async function rollbackToDbSessions() {
  console.log('⚠️ Redis 세션을 DB로 롤백 시작...\n');
  
  const sessionManager = getSessionManager();
  const redisSessionKeys = await sessionManager.cache.keys('session:*');
  
  let restored = 0;
  let failed = 0;
  
  for (const key of redisSessionKeys) {
    const sessionId = key.replace('session:', '');
    const sessionData = await sessionManager.getSession(sessionId);
    
    if (sessionData && sessionData.userId) {
      try {
        // DB에 세션 복원
        await db.session.create({
          data: {
            userId: sessionData.userId,
            token: sessionData.sessionToken || crypto.randomBytes(32).toString('hex'),
            expiresAt: new Date(Date.now() + (sessionData.rememberMe ? 30 * 24 * 3600 * 1000 : 24 * 3600 * 1000)),
            createdAt: new Date(sessionData.createdAt || Date.now()),
          },
        });
        restored++;
      } catch (error) {
        console.error(`세션 ${sessionId} 복원 실패:`, error);
        failed++;
      }
    }
  }
  
  console.log('\n📊 롤백 결과:');
  console.log(`✅ 복원됨: ${restored}개`);
  console.log(`❌ 실패: ${failed}개`);
  
  return { restored, failed };
}

// CLI 실행
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'migrate':
      runSessionMigration()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
      break;
      
    case 'validate':
      validateSessionSync()
        .then(result => {
          console.log('\n✅ 검증 완료');
          process.exit(result.synced ? 0 : 1);
        })
        .catch(() => process.exit(1));
      break;
      
    case 'rollback':
      rollbackToDbSessions()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
      break;
      
    default:
      console.log('사용법:');
      console.log('  npm run session:migrate    # DB 세션을 Redis로 마이그레이션');
      console.log('  npm run session:validate   # 세션 동기화 검증');
      console.log('  npm run session:rollback   # Redis 세션을 DB로 롤백');
      process.exit(1);
  }
}