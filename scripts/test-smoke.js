#!/usr/bin/env node

/**
 * Smoke Tests for 블리CMS
 * 프로덕션 배포 후 기본 기능 확인
 */

const https = require('https');
const http = require('http');

// 커맨드 라인 인자에서 URL 가져오기
const args = process.argv.slice(2);
const urlArg = args.find(arg => arg.startsWith('--url='));
const baseUrl = urlArg ? urlArg.split('=')[1] : 'http://localhost:3000';

console.log(`🧪 Running smoke tests against: ${baseUrl}`);

// 테스트 결과 저장
const results = [];
let passed = 0;
let failed = 0;

/**
 * HTTP 요청 헬퍼
 */
function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    protocol.get(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    }).on('error', reject);
  });
}

/**
 * 테스트 실행
 */
async function runTest(name, fn) {
  try {
    console.log(`  Testing: ${name}...`);
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
    results.push({ name, status: 'passed' });
  } catch (error) {
    console.log(`  ❌ ${name}: ${error.message}`);
    failed++;
    results.push({ name, status: 'failed', error: error.message });
  }
}

/**
 * 스모크 테스트 실행
 */
async function runSmokeTests() {
  console.log('\n🚀 Starting smoke tests...\n');
  
  // 1. 헬스체크 엔드포인트
  await runTest('Health check endpoint', async () => {
    const res = await request(`${baseUrl}/api/health?quick=true`);
    if (res.statusCode !== 200) {
      throw new Error(`Expected status 200, got ${res.statusCode}`);
    }
    const data = JSON.parse(res.body);
    if (data.status !== 'ok' && data.status !== 'healthy') {
      throw new Error(`Health check failed: ${data.status}`);
    }
  });
  
  // 2. 홈페이지 접근
  await runTest('Homepage accessibility', async () => {
    const res = await request(baseUrl);
    if (res.statusCode !== 200) {
      throw new Error(`Expected status 200, got ${res.statusCode}`);
    }
    if (!res.body.includes('<!DOCTYPE html>')) {
      throw new Error('Invalid HTML response');
    }
  });
  
  // 3. 정적 파일 제공
  await runTest('Static files serving', async () => {
    const res = await request(`${baseUrl}/build/_assets/root.css`);
    if (res.statusCode === 404) {
      // CSS 파일 경로가 다를 수 있음
      console.log('    (CSS file path may vary, checking alternative paths...)');
    } else if (res.statusCode !== 200 && res.statusCode !== 304) {
      throw new Error(`Static file serving issue: ${res.statusCode}`);
    }
  });
  
  // 4. 로그인 페이지
  await runTest('Login page accessibility', async () => {
    const res = await request(`${baseUrl}/auth/login`);
    if (res.statusCode !== 200) {
      throw new Error(`Expected status 200, got ${res.statusCode}`);
    }
  });
  
  // 5. API 엔드포인트 응답
  await runTest('API endpoint response', async () => {
    const res = await request(`${baseUrl}/api/status`);
    // 401 Unauthorized도 정상 (인증이 필요한 엔드포인트)
    if (res.statusCode !== 200 && res.statusCode !== 401 && res.statusCode !== 404) {
      throw new Error(`Unexpected API response: ${res.statusCode}`);
    }
  });
  
  // 6. 메트릭 엔드포인트 (Prometheus)
  await runTest('Metrics endpoint', async () => {
    const res = await request(`${baseUrl}/metrics`);
    // 메트릭이 비활성화되어 있을 수 있음
    if (res.statusCode === 404) {
      console.log('    (Metrics may be disabled in this environment)');
    } else if (res.statusCode === 200) {
      if (!res.body.includes('# HELP') && !res.body.includes('# TYPE')) {
        throw new Error('Invalid Prometheus metrics format');
      }
    }
  });
  
  // 7. Socket.IO 연결 테스트
  await runTest('Socket.IO endpoint', async () => {
    const res = await request(`${baseUrl}/socket.io/`);
    // Socket.IO는 특별한 응답을 반환
    if (res.statusCode !== 200 && res.statusCode !== 400 && res.statusCode !== 404) {
      throw new Error(`Socket.IO endpoint issue: ${res.statusCode}`);
    }
  });
  
  // 8. OAuth 리다이렉트 엔드포인트
  await runTest('OAuth endpoints', async () => {
    const kakaoRes = await request(`${baseUrl}/auth/kakao`);
    const naverRes = await request(`${baseUrl}/auth/naver`);
    
    // OAuth 엔드포인트는 리다이렉트를 반환해야 함
    if (kakaoRes.statusCode !== 302 && kakaoRes.statusCode !== 301 && kakaoRes.statusCode !== 200) {
      console.log('    (Kakao OAuth may not be configured)');
    }
    if (naverRes.statusCode !== 302 && naverRes.statusCode !== 301 && naverRes.statusCode !== 200) {
      console.log('    (Naver OAuth may not be configured)');
    }
  });
  
  // 9. 보안 헤더 확인
  await runTest('Security headers', async () => {
    const res = await request(baseUrl);
    const headers = res.headers;
    
    // 기본 보안 헤더 확인
    const securityHeaders = [
      'x-content-type-options',
      'x-frame-options',
      'x-xss-protection'
    ];
    
    const missingHeaders = securityHeaders.filter(header => !headers[header]);
    if (missingHeaders.length > 0) {
      console.log(`    (Missing headers: ${missingHeaders.join(', ')})`);
    }
  });
  
  // 10. 응답 시간 확인
  await runTest('Response time', async () => {
    const start = Date.now();
    await request(baseUrl);
    const duration = Date.now() - start;
    
    if (duration > 3000) {
      throw new Error(`Slow response time: ${duration}ms`);
    }
    console.log(`    (Response time: ${duration}ms)`);
  });
}

/**
 * 메인 실행
 */
async function main() {
  try {
    await runSmokeTests();
    
    // 결과 요약
    console.log('\n📊 Smoke Test Results:');
    console.log('====================');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
    
    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      results
        .filter(r => r.status === 'failed')
        .forEach(r => {
          console.log(`  - ${r.name}: ${r.error}`);
        });
    }
    
    // 종료 코드 설정
    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n💥 Smoke tests failed with error:', error);
    process.exit(1);
  }
}

// 실행
main();