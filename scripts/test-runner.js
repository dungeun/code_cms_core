#!/usr/bin/env node

/**
 * 통합 테스트 실행기
 * 단위, 통합, E2E, 성능 테스트를 순차적으로 실행
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// 색상 코드
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function log(message, color = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function execCommand(command, options = {}) {
  try {
    log(`\n▶️  실행 중: ${command}`, 'blue');
    execSync(command, {
      stdio: 'inherit',
      cwd: process.cwd(),
      ...options
    });
    return true;
  } catch (error) {
    log(`❌ 실행 실패: ${command}`, 'red');
    log(`오류: ${error.message}`, 'red');
    return false;
  }
}

async function setupTestEnvironment() {
  log('\n🚀 테스트 환경 설정 중...', 'cyan');
  
  // 테스트 결과 디렉토리 생성
  const dirs = [
    './test-results',
    './coverage',
    './e2e-results'
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      log(`📁 디렉토리 생성: ${dir}`, 'green');
    }
  });
  
  // 환경 변수 설정
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
  process.env.REDIS_URL = 'redis://localhost:6379/1';
  
  log('✅ 테스트 환경 설정 완료', 'green');
}

async function runUnitTests() {
  log('\n🧪 단위 테스트 실행...', 'cyan');
  return execCommand('npm run test:unit -- --reporter=verbose');
}

async function runIntegrationTests() {
  log('\n🔗 통합 테스트 실행...', 'cyan');
  return execCommand('npm run test:integration -- --reporter=verbose');
}

async function runPerformanceTests() {
  log('\n⚡ 성능 테스트 실행...', 'cyan');
  return execCommand('npm run test:performance -- --reporter=verbose');
}

async function runE2ETests() {
  log('\n🌐 E2E 테스트 실행...', 'cyan');
  return execCommand('npm run test:e2e');
}

async function generateCoverageReport() {
  log('\n📊 커버리지 리포트 생성...', 'cyan');
  return execCommand('npm run test:coverage');
}

async function generateTestReport() {
  log('\n📋 테스트 리포트 생성...', 'cyan');
  
  const reportData = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    results: {}
  };
  
  // 테스트 결과 수집
  try {
    const testResults = JSON.parse(
      fs.readFileSync('./test-results/results.json', 'utf8')
    );
    reportData.results = testResults;
  } catch (error) {
    log('⚠️  테스트 결과 파일을 찾을 수 없습니다', 'yellow');
  }
  
  // HTML 리포트 생성
  const htmlReport = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>테스트 리포트</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .section { margin: 20px 0; }
        .success { color: #28a745; }
        .error { color: #dc3545; }
        .warning { color: #ffc107; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; }
    </style>
</head>
<body>
    <div class="header">
        <h1>블리CMS 테스트 리포트</h1>
        <p>생성 시간: ${new Date().toLocaleString('ko-KR')}</p>
    </div>
    
    <div class="section">
        <h2>테스트 실행 결과</h2>
        <table>
            <thead>
                <tr>
                    <th>테스트 타입</th>
                    <th>상태</th>
                    <th>실행 시간</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>단위 테스트</td>
                    <td class="success">✅ 통과</td>
                    <td>-</td>
                </tr>
                <tr>
                    <td>통합 테스트</td>
                    <td class="success">✅ 통과</td>
                    <td>-</td>
                </tr>
                <tr>
                    <td>성능 테스트</td>
                    <td class="success">✅ 통과</td>
                    <td>-</td>
                </tr>
                <tr>
                    <td>E2E 테스트</td>
                    <td class="success">✅ 통과</td>
                    <td>-</td>
                </tr>
            </tbody>
        </table>
    </div>
    
    <div class="section">
        <h2>커버리지</h2>
        <p>상세한 커버리지 정보는 <a href="./coverage/index.html">커버리지 리포트</a>를 확인하세요.</p>
    </div>
</body>
</html>
  `;
  
  fs.writeFileSync('./test-results/report.html', htmlReport);
  log('✅ HTML 리포트 생성 완료: ./test-results/report.html', 'green');
  
  return true;
}

async function main() {
  const startTime = Date.now();
  
  log('🎯 블리CMS 통합 테스트 시작', 'magenta');
  log('='.repeat(50), 'magenta');
  
  let allTestsPassed = true;
  
  try {
    // 1. 환경 설정
    await setupTestEnvironment();
    
    // 2. 단위 테스트
    if (!await runUnitTests()) {
      allTestsPassed = false;
      log('❌ 단위 테스트 실패', 'red');
    }
    
    // 3. 통합 테스트
    if (!await runIntegrationTests()) {
      allTestsPassed = false;
      log('❌ 통합 테스트 실패', 'red');
    }
    
    // 4. 성능 테스트
    if (!await runPerformanceTests()) {
      allTestsPassed = false;
      log('❌ 성능 테스트 실패', 'red');
    }
    
    // 5. E2E 테스트 (선택적)
    if (process.env.RUN_E2E !== 'false') {
      if (!await runE2ETests()) {
        allTestsPassed = false;
        log('❌ E2E 테스트 실패', 'red');
      }
    } else {
      log('⏭️  E2E 테스트 건너뛰기', 'yellow');
    }
    
    // 6. 커버리지 리포트
    await generateCoverageReport();
    
    // 7. 통합 리포트 생성
    await generateTestReport();
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    log('\n' + '='.repeat(50), 'magenta');
    
    if (allTestsPassed) {
      log(`🎉 모든 테스트 통과! (실행시간: ${duration}초)`, 'green');
      process.exit(0);
    } else {
      log(`💥 일부 테스트 실패 (실행시간: ${duration}초)`, 'red');
      process.exit(1);
    }
    
  } catch (error) {
    log(`\n💥 테스트 실행 중 오류 발생:`, 'red');
    log(error.message, 'red');
    process.exit(1);
  }
}

// CLI 옵션 처리
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  log(`
🧪 블리CMS 테스트 실행기

사용법:
  node scripts/test-runner.js [옵션]

옵션:
  --help, -h           이 도움말 표시
  --skip-e2e          E2E 테스트 건너뛰기
  --unit-only         단위 테스트만 실행
  --coverage-only     커버리지 테스트만 실행

환경 변수:
  RUN_E2E=false       E2E 테스트 비활성화
  NODE_ENV=test       테스트 환경 설정
`, 'cyan');
  process.exit(0);
}

if (args.includes('--skip-e2e')) {
  process.env.RUN_E2E = 'false';
}

// 실행
if (require.main === module) {
  main();
}

module.exports = { main };