/**
 * 플러그인 샌드박스 보안 시스템
 * VM2와 Worker Threads를 활용한 안전한 플러그인 실행 환경
 */

import { Worker } from 'worker_threads';
import * as vm from 'vm';
import * as path from 'path';
import * as fs from 'fs/promises';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '~/lib/prisma.server';
import { getRedisClient } from '~/lib/redis.server';

// 플러그인 메타데이터 스키마
const PluginMetadataSchema = z.object({
  name: z.string().min(1).max(100),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string().max(500),
  author: z.string(),
  license: z.string(),
  permissions: z.array(z.enum([
    'read_files',
    'write_files',
    'network_access',
    'database_read',
    'database_write',
    'system_info',
    'user_data',
    'notifications',
    'analytics',
  ])),
  dependencies: z.record(z.string()).optional(),
  hooks: z.array(z.enum([
    'onInstall',
    'onUninstall',
    'onEnable',
    'onDisable',
    'onUpdate',
    'beforeRequest',
    'afterRequest',
    'beforeRender',
    'afterRender',
  ])).optional(),
});

export type PluginMetadata = z.infer<typeof PluginMetadataSchema>;

// 플러그인 실행 컨텍스트
interface PluginContext {
  pluginId: string;
  userId: string;
  permissions: string[];
  config: Record<string, any>;
  data: Record<string, any>;
}

// 플러그인 실행 결과
interface PluginExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  logs: string[];
  metrics: {
    executionTime: number;
    memoryUsed: number;
    cpuUsage: number;
  };
}

export class PluginSandbox {
  private redis = getRedisClient();
  private workerPool: Worker[] = [];
  private maxWorkers = 4;
  private workerTimeout = 30000; // 30초
  private maxMemory = 128 * 1024 * 1024; // 128MB
  private maxCpuTime = 5000; // 5초

  constructor() {
    this.initializeWorkerPool();
  }

  /**
   * Worker 풀 초기화
   */
  private async initializeWorkerPool() {
    for (let i = 0; i < this.maxWorkers; i++) {
      await this.createWorker();
    }
  }

  /**
   * Worker 생성
   */
  private async createWorker(): Promise<Worker> {
    const workerPath = path.join(__dirname, 'plugin-worker.js');
    const worker = new Worker(workerPath, {
      resourceLimits: {
        maxOldGenerationSizeMb: 128,
        maxYoungGenerationSizeMb: 48,
      },
    });

    worker.on('error', (error) => {
      console.error('Worker error:', error);
      this.replaceWorker(worker);
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`Worker exited with code ${code}`);
        this.replaceWorker(worker);
      }
    });

    this.workerPool.push(worker);
    return worker;
  }

  /**
   * Worker 교체
   */
  private async replaceWorker(oldWorker: Worker) {
    const index = this.workerPool.indexOf(oldWorker);
    if (index !== -1) {
      this.workerPool.splice(index, 1);
      await this.createWorker();
    }
  }

  /**
   * 플러그인 검증
   */
  async validatePlugin(pluginPath: string): Promise<{ valid: boolean; metadata?: PluginMetadata; error?: string }> {
    try {
      // 플러그인 파일 읽기
      const pluginContent = await fs.readFile(pluginPath, 'utf-8');
      
      // 메타데이터 추출
      const metadataMatch = pluginContent.match(/\/\*\*\s*@metadata\s*([\s\S]*?)\*\//);
      if (!metadataMatch) {
        return { valid: false, error: '플러그인 메타데이터를 찾을 수 없습니다.' };
      }

      const metadataJson = metadataMatch[1].trim();
      const metadata = JSON.parse(metadataJson);
      
      // 메타데이터 검증
      const validationResult = PluginMetadataSchema.safeParse(metadata);
      if (!validationResult.success) {
        return { valid: false, error: validationResult.error.message };
      }

      // 코드 정적 분석
      const securityIssues = await this.analyzeCode(pluginContent);
      if (securityIssues.length > 0) {
        return { 
          valid: false, 
          error: `보안 문제 발견: ${securityIssues.join(', ')}` 
        };
      }

      // 체크섬 생성
      const checksum = crypto
        .createHash('sha256')
        .update(pluginContent)
        .digest('hex');

      // 플러그인 정보 저장
      await prisma.plugin.create({
        data: {
          name: validationResult.data.name,
          version: validationResult.data.version,
          description: validationResult.data.description,
          author: validationResult.data.author,
          license: validationResult.data.license,
          permissions: validationResult.data.permissions,
          metadata: validationResult.data as any,
          checksum,
          status: 'validated',
        },
      });

      return { valid: true, metadata: validationResult.data };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * 코드 정적 분석
   */
  private async analyzeCode(code: string): Promise<string[]> {
    const issues: string[] = [];
    
    // 위험한 API 검사
    const dangerousAPIs = [
      'eval',
      'Function',
      'require',
      'process',
      'child_process',
      '__proto__',
      'constructor',
      'prototype',
    ];

    for (const api of dangerousAPIs) {
      if (code.includes(api)) {
        issues.push(`위험한 API 사용: ${api}`);
      }
    }

    // 파일 시스템 접근 검사
    const fsPatterns = [
      /fs\./g,
      /readFile/g,
      /writeFile/g,
      /unlink/g,
      /rmdir/g,
    ];

    for (const pattern of fsPatterns) {
      if (pattern.test(code)) {
        issues.push('파일 시스템 직접 접근 시도');
      }
    }

    // 네트워크 접근 검사
    const networkPatterns = [
      /http\./g,
      /https\./g,
      /net\./g,
      /dgram\./g,
      /fetch\(/g,
      /XMLHttpRequest/g,
    ];

    for (const pattern of networkPatterns) {
      if (pattern.test(code)) {
        issues.push('네트워크 직접 접근 시도');
      }
    }

    return issues;
  }

  /**
   * 플러그인 실행
   */
  async executePlugin(
    pluginId: string,
    method: string,
    args: any[],
    context: PluginContext
  ): Promise<PluginExecutionResult> {
    const startTime = Date.now();
    const logs: string[] = [];

    try {
      // 플러그인 정보 조회
      const plugin = await prisma.plugin.findUnique({
        where: { id: pluginId },
      });

      if (!plugin) {
        throw new Error('플러그인을 찾을 수 없습니다.');
      }

      if (plugin.status !== 'enabled') {
        throw new Error('플러그인이 비활성화되어 있습니다.');
      }

      // 권한 검증
      const requiredPermissions = plugin.permissions as string[];
      const hasPermissions = requiredPermissions.every(perm => 
        context.permissions.includes(perm)
      );

      if (!hasPermissions) {
        throw new Error('권한이 부족합니다.');
      }

      // Worker 선택
      const worker = this.getAvailableWorker();
      if (!worker) {
        throw new Error('사용 가능한 Worker가 없습니다.');
      }

      // 실행 요청
      const executionPromise = new Promise<PluginExecutionResult>((resolve, reject) => {
        const timeout = setTimeout(() => {
          worker.terminate();
          reject(new Error('플러그인 실행 시간 초과'));
        }, this.workerTimeout);

        worker.once('message', (result: PluginExecutionResult) => {
          clearTimeout(timeout);
          resolve(result);
        });

        worker.once('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });

        // 플러그인 실행 요청
        worker.postMessage({
          pluginId,
          pluginPath: plugin.path,
          method,
          args,
          context: this.createSafeContext(context),
        });
      });

      const result = await executionPromise;

      // 실행 로그 저장
      await this.saveExecutionLog(pluginId, {
        method,
        args,
        context,
        result,
        executionTime: Date.now() - startTime,
      });

      return {
        ...result,
        metrics: {
          executionTime: Date.now() - startTime,
          memoryUsed: process.memoryUsage().heapUsed,
          cpuUsage: process.cpuUsage().user,
        },
      };
    } catch (error) {
      logs.push(`Error: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
        logs,
        metrics: {
          executionTime: Date.now() - startTime,
          memoryUsed: process.memoryUsage().heapUsed,
          cpuUsage: process.cpuUsage().user,
        },
      };
    }
  }

  /**
   * 안전한 컨텍스트 생성
   */
  private createSafeContext(context: PluginContext): any {
    const safeContext = {
      // 기본 전역 객체
      console: {
        log: (...args: any[]) => this.log('log', args),
        error: (...args: any[]) => this.log('error', args),
        warn: (...args: any[]) => this.log('warn', args),
        info: (...args: any[]) => this.log('info', args),
      },
      
      // 타이머 (제한적)
      setTimeout: (fn: Function, delay: number) => {
        if (delay > 10000) delay = 10000; // 최대 10초
        return setTimeout(fn, delay);
      },
      
      setInterval: (fn: Function, interval: number) => {
        if (interval < 1000) interval = 1000; // 최소 1초
        return setInterval(fn, interval);
      },
      
      clearTimeout,
      clearInterval,
      
      // 안전한 API
      JSON,
      Math,
      Date,
      Array,
      Object: {
        keys: Object.keys,
        values: Object.values,
        entries: Object.entries,
        assign: Object.assign,
        freeze: Object.freeze,
      },
      
      // 플러그인 API
      plugin: this.createPluginAPI(context),
    };

    return vm.createContext(safeContext);
  }

  /**
   * 플러그인 API 생성
   */
  private createPluginAPI(context: PluginContext) {
    return {
      // 데이터 저장소
      storage: {
        get: async (key: string) => {
          if (!context.permissions.includes('database_read')) {
            throw new Error('데이터베이스 읽기 권한이 없습니다.');
          }
          return await this.redis.hget(`plugin:${context.pluginId}:storage`, key);
        },
        
        set: async (key: string, value: any) => {
          if (!context.permissions.includes('database_write')) {
            throw new Error('데이터베이스 쓰기 권한이 없습니다.');
          }
          return await this.redis.hset(
            `plugin:${context.pluginId}:storage`,
            key,
            JSON.stringify(value)
          );
        },
        
        delete: async (key: string) => {
          if (!context.permissions.includes('database_write')) {
            throw new Error('데이터베이스 쓰기 권한이 없습니다.');
          }
          return await this.redis.hdel(`plugin:${context.pluginId}:storage`, key);
        },
      },
      
      // HTTP 요청 (제한적)
      http: {
        get: async (url: string) => {
          if (!context.permissions.includes('network_access')) {
            throw new Error('네트워크 접근 권한이 없습니다.');
          }
          
          // 화이트리스트 검증
          const allowedDomains = await this.getAllowedDomains(context.pluginId);
          const urlObj = new URL(url);
          
          if (!allowedDomains.includes(urlObj.hostname)) {
            throw new Error('허용되지 않은 도메인입니다.');
          }
          
          const response = await fetch(url, {
            method: 'GET',
            timeout: 5000,
          });
          
          return response.json();
        },
      },
      
      // 이벤트 발생
      emit: async (event: string, data: any) => {
        if (!context.permissions.includes('notifications')) {
          throw new Error('알림 권한이 없습니다.');
        }
        
        await this.redis.publish(
          `plugin:${context.pluginId}:events`,
          JSON.stringify({ event, data })
        );
      },
      
      // 설정 접근
      config: context.config,
      
      // 사용자 데이터 (제한적)
      user: context.permissions.includes('user_data') ? {
        id: context.userId,
        // 추가 사용자 정보는 권한에 따라 제공
      } : null,
    };
  }

  /**
   * 사용 가능한 Worker 선택
   */
  private getAvailableWorker(): Worker | null {
    // 간단한 라운드 로빈 방식
    // 실제로는 더 복잡한 로드 밸런싱 로직 필요
    return this.workerPool[Math.floor(Math.random() * this.workerPool.length)];
  }

  /**
   * 로그 저장
   */
  private log(level: string, args: any[]) {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    
    // 로그를 Redis에 저장
    this.redis.rpush('plugin:logs', JSON.stringify({
      level,
      message,
      timestamp: new Date().toISOString(),
    }));
  }

  /**
   * 실행 로그 저장
   */
  private async saveExecutionLog(pluginId: string, log: any) {
    await prisma.pluginExecutionLog.create({
      data: {
        pluginId,
        method: log.method,
        args: log.args,
        context: log.context,
        result: log.result,
        executionTime: log.executionTime,
        timestamp: new Date(),
      },
    });
  }

  /**
   * 허용된 도메인 조회
   */
  private async getAllowedDomains(pluginId: string): Promise<string[]> {
    const plugin = await prisma.plugin.findUnique({
      where: { id: pluginId },
      select: { allowedDomains: true },
    });
    
    return plugin?.allowedDomains || [];
  }

  /**
   * 플러그인 설치
   */
  async installPlugin(pluginPath: string, userId: string): Promise<boolean> {
    try {
      // 플러그인 검증
      const validation = await this.validatePlugin(pluginPath);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // 플러그인 파일 복사
      const pluginName = validation.metadata!.name;
      const pluginVersion = validation.metadata!.version;
      const targetPath = path.join(
        process.cwd(),
        'plugins',
        `${pluginName}-${pluginVersion}.js`
      );

      await fs.copyFile(pluginPath, targetPath);

      // 플러그인 정보 업데이트
      await prisma.plugin.update({
        where: { 
          name_version: {
            name: pluginName,
            version: pluginVersion,
          },
        },
        data: {
          path: targetPath,
          installedBy: userId,
          installedAt: new Date(),
          status: 'installed',
        },
      });

      // 설치 훅 실행
      if (validation.metadata!.hooks?.includes('onInstall')) {
        await this.executePlugin(
          pluginName,
          'onInstall',
          [],
          {
            pluginId: pluginName,
            userId,
            permissions: validation.metadata!.permissions,
            config: {},
            data: {},
          }
        );
      }

      return true;
    } catch (error) {
      console.error('플러그인 설치 실패:', error);
      return false;
    }
  }

  /**
   * 플러그인 제거
   */
  async uninstallPlugin(pluginId: string, userId: string): Promise<boolean> {
    try {
      const plugin = await prisma.plugin.findUnique({
        where: { id: pluginId },
      });

      if (!plugin) {
        throw new Error('플러그인을 찾을 수 없습니다.');
      }

      // 제거 훅 실행
      const metadata = plugin.metadata as PluginMetadata;
      if (metadata.hooks?.includes('onUninstall')) {
        await this.executePlugin(
          pluginId,
          'onUninstall',
          [],
          {
            pluginId,
            userId,
            permissions: metadata.permissions,
            config: {},
            data: {},
          }
        );
      }

      // 플러그인 파일 삭제
      if (plugin.path) {
        await fs.unlink(plugin.path);
      }

      // 플러그인 정보 삭제
      await prisma.plugin.delete({
        where: { id: pluginId },
      });

      // 관련 데이터 정리
      await this.redis.del(`plugin:${pluginId}:storage`);

      return true;
    } catch (error) {
      console.error('플러그인 제거 실패:', error);
      return false;
    }
  }

  /**
   * 플러그인 활성화/비활성화
   */
  async togglePlugin(pluginId: string, enabled: boolean): Promise<boolean> {
    try {
      await prisma.plugin.update({
        where: { id: pluginId },
        data: { status: enabled ? 'enabled' : 'disabled' },
      });

      return true;
    } catch (error) {
      console.error('플러그인 상태 변경 실패:', error);
      return false;
    }
  }

  /**
   * 정리
   */
  async cleanup() {
    // Worker 종료
    for (const worker of this.workerPool) {
      await worker.terminate();
    }
    this.workerPool = [];
  }
}

// 싱글톤 인스턴스
let sandboxInstance: PluginSandbox | null = null;

export function getPluginSandbox(): PluginSandbox {
  if (!sandboxInstance) {
    sandboxInstance = new PluginSandbox();
  }
  return sandboxInstance;
}