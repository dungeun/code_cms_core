// 글로벌 테스트 설정

import { execSync } from 'child_process';

export default async function globalSetup() {
  console.log('🚀 테스트 환경 설정 중...');
  
  try {
    // 테스트 데이터베이스 마이그레이션
    console.log('📊 테스트 데이터베이스 설정...');
    execSync('npx prisma migrate reset --force --skip-generate', {
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db'
      }
    });
    
    execSync('npx prisma migrate deploy', {
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
    
    // 테스트용 환경 변수 검증
    const requiredEnvVars = [
      'DATABASE_URL',
      'JWT_SECRET',
      'ENCRYPTION_KEY'
    ];
    
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`필수 환경 변수가 설정되지 않음: ${envVar}`);
      }
    }
    
    console.log('✅ 글로벌 테스트 설정 완료');
  } catch (error) {
    console.error('❌ 글로벌 테스트 설정 실패:', error);
    throw error;
  }
}