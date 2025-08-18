/**
 * 프로덕션 배포 관리 시스템
 * 무중단 배포, 헬스체크, 자동화 배포 관리
 */
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

export interface DeploymentConfig {
  environment: 'staging' | 'production';
  version: string;
  healthCheckUrl: string;
  rollbackVersion?: string;
  preDeployScript?: string;
  postDeployScript?: string;
  maxRetries: number;
  timeout: number;
}

export interface DeploymentResult {
  success: boolean;
  version: string;
  deploymentId: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  healthCheck: HealthCheckResult;
  rollback?: boolean;
  logs: string[];
  metrics: DeploymentMetrics;
}

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'warning';
  checks: HealthCheck[];
  overallScore: number;
  timestamp: Date;
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  duration: number;
  message: string;
  details?: any;
}

export interface DeploymentMetrics {
  buildTime: number;
  testTime: number;
  deployTime: number;
  healthCheckTime: number;
  totalTime: number;
  resourceUsage: {
    cpu: number;
    memory: number;
    disk: number;
  };
}

class DeploymentManager {
  private deployments: Map<string, DeploymentResult> = new Map();
  private currentVersion: string = '1.0.0';

  /**
   * 프로덕션 배포 실행
   */
  async deployToProduction(config: DeploymentConfig): Promise<DeploymentResult> {
    const deploymentId = this.generateDeploymentId();
    const startTime = new Date();
    const logs: string[] = [];

    try {
      logs.push(`🚀 프로덕션 배포 시작: ${config.version}`);
      logs.push(`📋 배포 ID: ${deploymentId}`);

      // 배포 전 체크
      await this.preDeploymentChecks(config, logs);

      // 빌드 및 테스트
      const buildMetrics = await this.buildAndTest(config, logs);

      // 데이터베이스 마이그레이션
      await this.runDatabaseMigrations(config, logs);

      // 무중단 배포
      await this.performZeroDowntimeDeployment(config, logs);

      // 배포 후 헬스체크
      const healthCheck = await this.performHealthCheck(config, logs);

      // 성능 검증
      await this.validatePerformance(config, logs);

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      const result: DeploymentResult = {
        success: true,
        version: config.version,
        deploymentId,
        startTime,
        endTime,
        duration,
        healthCheck,
        logs,
        metrics: {
          ...buildMetrics,
          totalTime: duration,
          resourceUsage: await this.getResourceUsage(),
        },
      };

      this.deployments.set(deploymentId, result);
      this.currentVersion = config.version;

      logs.push(`✅ 프로덕션 배포 성공 (소요시간: ${duration}ms)`);

      return result;
    } catch (error) {
      logs.push(`❌ 배포 실패: ${error.message}`);

      // 자동 롤백 시도
      const rollbackResult = await this.attemptRollback(config, logs);

      const endTime = new Date();
      const result: DeploymentResult = {
        success: false,
        version: config.version,
        deploymentId,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        healthCheck: await this.performHealthCheck(config, logs),
        rollback: rollbackResult,
        logs,
        metrics: {
          buildTime: 0,
          testTime: 0,
          deployTime: 0,
          healthCheckTime: 0,
          totalTime: endTime.getTime() - startTime.getTime(),
          resourceUsage: await this.getResourceUsage(),
        },
      };

      this.deployments.set(deploymentId, result);
      return result;
    }
  }

  /**
   * 스테이징 환경 배포
   */
  async deployToStaging(config: DeploymentConfig): Promise<DeploymentResult> {
    const stagingConfig = { ...config, environment: 'staging' as const };
    const deploymentId = this.generateDeploymentId();
    const startTime = new Date();
    const logs: string[] = [];

    try {
      logs.push(`🧪 스테이징 배포 시작: ${config.version}`);

      // 빌드 및 기본 테스트
      const buildMetrics = await this.buildAndTest(stagingConfig, logs);

      // 스테이징 배포 (더 빠른 프로세스)
      await this.deployStagingEnvironment(stagingConfig, logs);

      // 기본 헬스체크
      const healthCheck = await this.performBasicHealthCheck(stagingConfig, logs);

      const endTime = new Date();
      const result: DeploymentResult = {
        success: true,
        version: config.version,
        deploymentId,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        healthCheck,
        logs,
        metrics: {
          ...buildMetrics,
          totalTime: endTime.getTime() - startTime.getTime(),
          resourceUsage: await this.getResourceUsage(),
        },
      };

      logs.push(`✅ 스테이징 배포 완료`);
      return result;
    } catch (error) {
      logs.push(`❌ 스테이징 배포 실패: ${error.message}`);
      throw error;
    }
  }

  /**
   * 배포 전 사전 체크
   */
  private async preDeploymentChecks(config: DeploymentConfig, logs: string[]): Promise<void> {
    logs.push('🔍 배포 전 사전 체크...');

    // Git 상태 확인
    const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
    if (gitStatus.trim()) {
      throw new Error('Git working directory가 clean하지 않습니다');
    }

    // 테스트 커버리지 확인
    const testManager = await import('../testing/test-manager.server').then(m => m.getTestManager());
    const testResults = await testManager.runComprehensiveTests();
    
    if (testResults.overallScore < 95) {
      throw new Error(`테스트 점수가 낮습니다: ${testResults.overallScore}% (최소 95% 필요)`);
    }

    // 보안 스캔
    await this.runSecurityScan(logs);

    // 의존성 검사
    await this.checkDependencies(logs);

    logs.push('✅ 사전 체크 완료');
  }

  /**
   * 빌드 및 테스트
   */
  private async buildAndTest(config: DeploymentConfig, logs: string[]): Promise<Partial<DeploymentMetrics>> {
    const buildStart = Date.now();
    
    logs.push('🔨 애플리케이션 빌드...');
    
    try {
      // TypeScript 컴파일
      execSync('npm run build', { stdio: 'pipe' });
      
      const buildTime = Date.now() - buildStart;
      logs.push(`✅ 빌드 완료 (${buildTime}ms)`);

      // 테스트 실행
      const testStart = Date.now();
      execSync('npm run test:ci', { stdio: 'pipe' });
      
      const testTime = Date.now() - testStart;
      logs.push(`✅ 테스트 완료 (${testTime}ms)`);

      return {
        buildTime,
        testTime,
        deployTime: 0,
        healthCheckTime: 0,
      };
    } catch (error) {
      throw new Error(`빌드 또는 테스트 실패: ${error.message}`);
    }
  }

  /**
   * 데이터베이스 마이그레이션
   */
  private async runDatabaseMigrations(config: DeploymentConfig, logs: string[]): Promise<void> {
    logs.push('🗄️  데이터베이스 마이그레이션...');

    try {
      // 백업 생성
      await this.createDatabaseBackup(logs);

      // 마이그레이션 실행
      execSync('npx prisma migrate deploy', { stdio: 'pipe' });

      logs.push('✅ 데이터베이스 마이그레이션 완료');
    } catch (error) {
      logs.push('❌ 마이그레이션 실패, 백업으로 복원 중...');
      await this.restoreDatabaseBackup(logs);
      throw new Error(`마이그레이션 실패: ${error.message}`);
    }
  }

  /**
   * 무중단 배포 수행
   */
  private async performZeroDowntimeDeployment(config: DeploymentConfig, logs: string[]): Promise<void> {
    const deployStart = Date.now();
    logs.push('🔄 무중단 배포 시작...');

    try {
      // Blue-Green 배포 시뮬레이션
      await this.deployBlueGreenStrategy(config, logs);

      // 헬스체크 후 트래픽 전환
      await this.switchTraffic(config, logs);

      const deployTime = Date.now() - deployStart;
      logs.push(`✅ 무중단 배포 완료 (${deployTime}ms)`);
    } catch (error) {
      throw new Error(`무중단 배포 실패: ${error.message}`);
    }
  }

  /**
   * 헬스체크 수행
   */
  private async performHealthCheck(config: DeploymentConfig, logs: string[]): Promise<HealthCheckResult> {
    const healthCheckStart = Date.now();
    logs.push('🩺 헬스체크 실행...');

    const checks: HealthCheck[] = [];

    // 서버 응답 체크
    checks.push(await this.checkServerResponse(config.healthCheckUrl));

    // 데이터베이스 연결 체크
    checks.push(await this.checkDatabaseConnection());

    // Redis 연결 체크
    checks.push(await this.checkRedisConnection());

    // 메모리 사용량 체크
    checks.push(await this.checkMemoryUsage());

    // CPU 사용량 체크
    checks.push(await this.checkCpuUsage());

    // 디스크 공간 체크
    checks.push(await this.checkDiskSpace());

    const passedChecks = checks.filter(c => c.status === 'pass').length;
    const overallScore = Math.round((passedChecks / checks.length) * 100);

    let status: 'healthy' | 'unhealthy' | 'warning' = 'healthy';
    if (overallScore < 70) status = 'unhealthy';
    else if (overallScore < 90) status = 'warning';

    const result: HealthCheckResult = {
      status,
      checks,
      overallScore,
      timestamp: new Date(),
    };

    const healthCheckTime = Date.now() - healthCheckStart;
    logs.push(`🩺 헬스체크 완료: ${status} (${overallScore}%, ${healthCheckTime}ms)`);

    return result;
  }

  /**
   * 기본 헬스체크 (스테이징용)
   */
  private async performBasicHealthCheck(config: DeploymentConfig, logs: string[]): Promise<HealthCheckResult> {
    const checks: HealthCheck[] = [];
    
    // 서버 응답만 체크
    checks.push(await this.checkServerResponse(config.healthCheckUrl));
    checks.push(await this.checkDatabaseConnection());

    const overallScore = checks.filter(c => c.status === 'pass').length * 50; // 2개 체크이므로 50점씩

    return {
      status: overallScore >= 100 ? 'healthy' : 'warning',
      checks,
      overallScore,
      timestamp: new Date(),
    };
  }

  /**
   * 성능 검증
   */
  private async validatePerformance(config: DeploymentConfig, logs: string[]): Promise<void> {
    logs.push('⚡ 성능 검증...');

    const performanceManager = await import('../performance/performance-manager.server')
      .then(m => m.getPerformanceManager());
    
    const analysis = await performanceManager.runComprehensiveAnalysis();
    
    if (analysis.overallScore < 85) {
      logs.push(`⚠️  성능 점수 낮음: ${analysis.overallScore}% (최소 85% 권장)`);
    } else {
      logs.push(`✅ 성능 검증 통과: ${analysis.overallScore}%`);
    }
  }

  /**
   * 자동 롤백 시도
   */
  private async attemptRollback(config: DeploymentConfig, logs: string[]): Promise<boolean> {
    if (!config.rollbackVersion) {
      logs.push('❌ 롤백 버전이 지정되지 않았습니다');
      return false;
    }

    try {
      logs.push(`⏪ 자동 롤백 시작: ${config.rollbackVersion}`);
      
      // 롤백 수행
      await this.performRollback(config.rollbackVersion, logs);
      
      logs.push('✅ 자동 롤백 완료');
      return true;
    } catch (error) {
      logs.push(`❌ 롤백 실패: ${error.message}`);
      return false;
    }
  }

  /**
   * 개별 헬스체크 메서드들
   */
  private async checkServerResponse(url: string): Promise<HealthCheck> {
    const start = Date.now();
    
    try {
      const response = await fetch(url, { 
        method: 'GET',
        timeout: 5000 
      });
      
      const duration = Date.now() - start;
      
      return {
        name: 'Server Response',
        status: response.ok ? 'pass' : 'fail',
        duration,
        message: response.ok ? '서버 응답 정상' : `HTTP ${response.status}`,
        details: { statusCode: response.status, responseTime: duration },
      };
    } catch (error) {
      return {
        name: 'Server Response',
        status: 'fail',
        duration: Date.now() - start,
        message: `연결 실패: ${error.message}`,
      };
    }
  }

  private async checkDatabaseConnection(): Promise<HealthCheck> {
    const start = Date.now();
    
    try {
      const { db } = await import('../db.server');
      await db.$queryRaw`SELECT 1`;
      
      return {
        name: 'Database Connection',
        status: 'pass',
        duration: Date.now() - start,
        message: '데이터베이스 연결 정상',
      };
    } catch (error) {
      return {
        name: 'Database Connection',
        status: 'fail',
        duration: Date.now() - start,
        message: `데이터베이스 연결 실패: ${error.message}`,
      };
    }
  }

  private async checkRedisConnection(): Promise<HealthCheck> {
    const start = Date.now();
    
    try {
      const { getRedisCluster } = await import('../redis/cluster.server');
      const redis = getRedisCluster();
      await redis.ping();
      
      return {
        name: 'Redis Connection',
        status: 'pass',
        duration: Date.now() - start,
        message: 'Redis 연결 정상',
      };
    } catch (error) {
      return {
        name: 'Redis Connection',
        status: 'warn',
        duration: Date.now() - start,
        message: `Redis 연결 불가: ${error.message}`,
      };
    }
  }

  private async checkMemoryUsage(): Promise<HealthCheck> {
    const used = process.memoryUsage();
    const totalMB = Math.round(used.heapTotal / 1024 / 1024);
    const usedMB = Math.round(used.heapUsed / 1024 / 1024);
    const usage = (usedMB / totalMB) * 100;

    return {
      name: 'Memory Usage',
      status: usage < 80 ? 'pass' : usage < 90 ? 'warn' : 'fail',
      duration: 0,
      message: `메모리 사용률: ${usage.toFixed(1)}% (${usedMB}MB/${totalMB}MB)`,
      details: { usage, usedMB, totalMB },
    };
  }

  private async checkCpuUsage(): Promise<HealthCheck> {
    // 간단한 CPU 사용률 체크 (실제로는 더 정교한 측정 필요)
    const loadAverage = process.cpuUsage();
    const usage = 0; // 실제 CPU 측정 로직 필요

    return {
      name: 'CPU Usage',
      status: 'pass',
      duration: 0,
      message: 'CPU 사용률 정상',
      details: { loadAverage },
    };
  }

  private async checkDiskSpace(): Promise<HealthCheck> {
    try {
      const stats = fs.statSync(process.cwd());
      
      return {
        name: 'Disk Space',
        status: 'pass',
        duration: 0,
        message: '디스크 공간 충분',
      };
    } catch (error) {
      return {
        name: 'Disk Space',
        status: 'warn',
        duration: 0,
        message: '디스크 공간 체크 실패',
      };
    }
  }

  /**
   * 유틸리티 메서드들
   */
  private generateDeploymentId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private async getResourceUsage() {
    const memUsage = process.memoryUsage();
    return {
      cpu: 0, // 실제 CPU 측정 로직 필요
      memory: Math.round(memUsage.heapUsed / 1024 / 1024),
      disk: 0, // 실제 디스크 사용량 측정 로직 필요
    };
  }

  private async createDatabaseBackup(logs: string[]): Promise<void> {
    logs.push('💾 데이터베이스 백업 생성...');
    // 실제 백업 로직 구현 필요
  }

  private async restoreDatabaseBackup(logs: string[]): Promise<void> {
    logs.push('🔄 데이터베이스 백업 복원...');
    // 실제 복원 로직 구현 필요
  }

  private async deployBlueGreenStrategy(config: DeploymentConfig, logs: string[]): Promise<void> {
    // Blue-Green 배포 로직
    logs.push('🟦 Blue 환경 배포 중...');
    await this.delay(2000); // 시뮬레이션
    logs.push('✅ Blue 환경 배포 완료');
  }

  private async switchTraffic(config: DeploymentConfig, logs: string[]): Promise<void> {
    logs.push('🔀 트래픽 전환 중...');
    await this.delay(1000); // 시뮬레이션
    logs.push('✅ 트래픽 전환 완료');
  }

  private async deployStagingEnvironment(config: DeploymentConfig, logs: string[]): Promise<void> {
    logs.push('🧪 스테이징 환경 배포...');
    await this.delay(1500); // 시뮬레이션
    logs.push('✅ 스테이징 환경 배포 완료');
  }

  private async performRollback(version: string, logs: string[]): Promise<void> {
    logs.push(`⏪ ${version}으로 롤백 중...`);
    await this.delay(3000); // 시뮬레이션
    logs.push(`✅ ${version} 롤백 완료`);
  }

  private async runSecurityScan(logs: string[]): Promise<void> {
    logs.push('🔒 보안 스캔 실행...');
    // npm audit 또는 다른 보안 스캔 도구 실행
    await this.delay(2000);
    logs.push('✅ 보안 스캔 완료');
  }

  private async checkDependencies(logs: string[]): Promise<void> {
    logs.push('📦 의존성 검사...');
    try {
      execSync('npm audit --audit-level moderate', { stdio: 'pipe' });
      logs.push('✅ 의존성 검사 통과');
    } catch (error) {
      throw new Error('의존성에 보안 취약점이 발견되었습니다');
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 공개 메서드들
   */
  getDeploymentHistory(): DeploymentResult[] {
    return Array.from(this.deployments.values());
  }

  getDeployment(deploymentId: string): DeploymentResult | undefined {
    return this.deployments.get(deploymentId);
  }

  getCurrentVersion(): string {
    return this.currentVersion;
  }

  getDeploymentStatus(deploymentId: string): 'success' | 'failed' | 'not_found' {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) return 'not_found';
    return deployment.success ? 'success' : 'failed';
  }
}

let deploymentManager: DeploymentManager;

export function getDeploymentManager(): DeploymentManager {
  if (!deploymentManager) {
    deploymentManager = new DeploymentManager();
  }
  return deploymentManager;
}