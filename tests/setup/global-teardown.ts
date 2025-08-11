// 글로벌 테스트 정리

import { execSync } from 'child_process';

export default async function globalTeardown() {
  console.log('🧹 테스트 환경 정리 중...');
  
  try {
    // 테스트 데이터베이스 정리
    console.log('📊 테스트 데이터 정리...');
    execSync('npx prisma migrate reset --force --skip-generate', {
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db'
      }
    });
    
    // Redis 테스트 데이터 정리
    console.log('🗑️  Redis 테스트 데이터 정리...');
    try {
      execSync('redis-cli -n 1 FLUSHDB', { stdio: 'inherit' });
    } catch (error) {
      console.warn('Redis 정리 중 오류 (무시됨):', error);
    }
    
    // 임시 파일 정리
    console.log('🗂️  임시 파일 정리...');
    try {
      execSync('rm -rf ./uploads/test-*', { stdio: 'inherit' });
      execSync('rm -rf ./test-results/temp-*', { stdio: 'inherit' });
    } catch (error) {
      console.warn('임시 파일 정리 중 오류 (무시됨):', error);
    }
    
    // 메모리 정리
    if (global.gc) {
      global.gc();
    }
    
    console.log('✅ 글로벌 테스트 정리 완료');
  } catch (error) {
    console.error('❌ 글로벌 테스트 정리 실패:', error);
    // 정리 실패는 다음 테스트 실행에 영향을 줄 수 있지만 현재 실행은 실패로 처리하지 않음
  }
}