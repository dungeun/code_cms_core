/**
 * 의존성 관리 시스템
 * 순환 참조 감지, 의존성 주입, 모듈 생명주기 관리
 */
import { performance } from 'perf_hooks';
import * as path from 'path';

/**
 * 의존성 매니저
 * 모듈 간 의존성을 관리하고 순환 참조를 방지
 */
export class DependencyManager {
  private dependencies = new Map<string, Set<string>>();
  private instances = new Map<string, any>();
  private singletons = new Map<string, any>();
  private factories = new Map<string, () => any>();
  private loading = new Set<string>();
  
  /**
   * 서비스 등록
   */
  register<T>(
    name: string, 
    factory: () => T | Promise<T>, 
    options?: ServiceOptions
  ): void {
    if (this.factories.has(name)) {
      throw new Error(`서비스 "${name}"이 이미 등록되어 있습니다`);
    }

    this.factories.set(name, factory);
    
    if (options?.dependencies) {
      this.dependencies.set(name, new Set(options.dependencies));
    }
    
    if (options?.singleton !== false) {
      // 기본적으로 싱글톤으로 등록
      this.singletons.set(name, null);
    }

    console.log(`📦 서비스 등록: ${name}${options?.singleton === false ? ' (인스턴스)' : ' (싱글톤)'}`);
  }

  /**
   * 서비스 해결 (Dependency Injection)
   */
  async resolve<T>(name: string): Promise<T> {
    // 순환 참조 검사
    if (this.loading.has(name)) {
      const cycle = Array.from(this.loading).join(' -> ') + ` -> ${name}`;
      throw new Error(`순환 참조 감지: ${cycle}`);
    }

    // 싱글톤 검사
    if (this.singletons.has(name) && this.singletons.get(name) !== null) {
      return this.singletons.get(name) as T;
    }

    // 팩토리 함수 존재 검사
    const factory = this.factories.get(name);
    if (!factory) {
      throw new Error(`서비스 "${name}"을 찾을 수 없습니다`);
    }

    this.loading.add(name);
    
    try {
      // 의존성 해결
      const dependencies = this.dependencies.get(name) || new Set();
      const resolvedDeps = new Map<string, any>();
      
      for (const dep of dependencies) {
        resolvedDeps.set(dep, await this.resolve(dep));
      }

      // 서비스 생성
      const start = performance.now();
      const instance = await factory();
      const duration = performance.now() - start;
      
      console.log(`⚡ 서비스 생성: ${name} (${duration.toFixed(2)}ms)`);

      // 의존성 주입 (만약 instance가 setDependencies 메서드를 가지고 있다면)
      if (instance && typeof instance.setDependencies === 'function') {
        instance.setDependencies(Object.fromEntries(resolvedDeps));
      }

      // 초기화 (만약 instance가 initialize 메서드를 가지고 있다면)
      if (instance && typeof instance.initialize === 'function') {
        await instance.initialize();
      }

      // 싱글톤 저장
      if (this.singletons.has(name)) {
        this.singletons.set(name, instance);
      }

      return instance as T;
    } finally {
      this.loading.delete(name);
    }
  }

  /**
   * 여러 서비스 한번에 해결
   */
  async resolveMultiple<T extends Record<string, any>>(
    services: Array<keyof T>
  ): Promise<T> {
    const resolved = {} as T;
    
    await Promise.all(
      services.map(async (serviceName) => {
        resolved[serviceName] = await this.resolve(serviceName as string);
      })
    );
    
    return resolved;
  }

  /**
   * 순환 참조 분석
   */
  analyzeDependencies(): DependencyAnalysis {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    const detectCycles = (node: string, path: string[]): void => {
      if (recursionStack.has(node)) {
        const cycleStart = path.indexOf(node);
        cycles.push([...path.slice(cycleStart), node]);
        return;
      }
      
      if (visited.has(node)) return;
      
      visited.add(node);
      recursionStack.add(node);
      path.push(node);
      
      const deps = this.dependencies.get(node) || new Set();
      for (const dep of deps) {
        detectCycles(dep, [...path]);
      }
      
      recursionStack.delete(node);
      path.pop();
    };

    // 모든 서비스에 대해 순환 참조 검사
    for (const service of this.factories.keys()) {
      if (!visited.has(service)) {
        detectCycles(service, []);
      }
    }

    // 의존성 트리 구성
    const dependencyTree = this.buildDependencyTree();
    
    // 로딩 순서 계산
    const loadOrder = this.calculateLoadOrder();

    return {
      totalServices: this.factories.size,
      circularDependencies: cycles,
      dependencyTree,
      loadOrder,
      hasCircularDependencies: cycles.length > 0,
    };
  }

  /**
   * 의존성 트리 구성
   */
  private buildDependencyTree(): DependencyTree {
    const tree: DependencyTree = {};
    
    for (const [service, deps] of this.dependencies.entries()) {
      tree[service] = {
        dependencies: Array.from(deps),
        dependents: [],
        level: 0,
      };
    }
    
    // 의존하는 서비스 추가
    for (const [service, deps] of this.dependencies.entries()) {
      for (const dep of deps) {
        if (tree[dep]) {
          tree[dep].dependents.push(service);
        }
      }
    }
    
    // 레벨 계산 (의존성 깊이)
    this.calculateDependencyLevels(tree);
    
    return tree;
  }

  /**
   * 의존성 레벨 계산
   */
  private calculateDependencyLevels(tree: DependencyTree): void {
    const calculateLevel = (service: string, visited = new Set<string>()): number => {
      if (visited.has(service)) return 0; // 순환 참조 방지
      
      const node = tree[service];
      if (!node || node.dependencies.length === 0) {
        return 0;
      }
      
      visited.add(service);
      
      let maxLevel = 0;
      for (const dep of node.dependencies) {
        if (tree[dep]) {
          maxLevel = Math.max(maxLevel, calculateLevel(dep, visited) + 1);
        }
      }
      
      visited.delete(service);
      node.level = maxLevel;
      return maxLevel;
    };

    for (const service of Object.keys(tree)) {
      calculateLevel(service);
    }
  }

  /**
   * 로딩 순서 계산
   */
  private calculateLoadOrder(): string[] {
    const tree = this.buildDependencyTree();
    const services = Object.keys(tree);
    
    // 의존성 레벨 기준으로 정렬
    return services.sort((a, b) => {
      const levelA = tree[a]?.level || 0;
      const levelB = tree[b]?.level || 0;
      return levelA - levelB;
    });
  }

  /**
   * 서비스 상태 조회
   */
  getServiceStatus(): ServiceStatus {
    const registered = this.factories.size;
    const singletons = Array.from(this.singletons.entries())
      .filter(([, instance]) => instance !== null).length;
    const loading = this.loading.size;
    
    return {
      registered,
      instantiated: singletons,
      loading,
      ready: registered - loading,
    };
  }

  /**
   * 서비스 재시작
   */
  async restart(serviceName: string): Promise<void> {
    if (!this.factories.has(serviceName)) {
      throw new Error(`서비스 "${serviceName}"을 찾을 수 없습니다`);
    }

    // 기존 인스턴스 제거
    if (this.singletons.has(serviceName)) {
      const instance = this.singletons.get(serviceName);
      
      // cleanup 메서드가 있다면 호출
      if (instance && typeof instance.cleanup === 'function') {
        await instance.cleanup();
      }
      
      this.singletons.set(serviceName, null);
    }

    // 의존하는 서비스들도 재시작
    const dependents = this.findDependents(serviceName);
    for (const dependent of dependents) {
      if (this.singletons.has(dependent)) {
        await this.restart(dependent);
      }
    }

    console.log(`🔄 서비스 재시작: ${serviceName}`);
  }

  /**
   * 특정 서비스에 의존하는 서비스들 찾기
   */
  private findDependents(serviceName: string): string[] {
    const dependents: string[] = [];
    
    for (const [service, deps] of this.dependencies.entries()) {
      if (deps.has(serviceName)) {
        dependents.push(service);
      }
    }
    
    return dependents;
  }

  /**
   * 전체 정리
   */
  async cleanup(): Promise<void> {
    console.log('🧹 의존성 매니저 정리 시작...');
    
    // 모든 인스턴스 정리
    for (const [name, instance] of this.singletons.entries()) {
      if (instance && typeof instance.cleanup === 'function') {
        try {
          await instance.cleanup();
          console.log(`✅ 서비스 정리 완료: ${name}`);
        } catch (error) {
          console.error(`❌ 서비스 정리 실패: ${name}`, error);
        }
      }
    }

    // 맵 클리어
    this.dependencies.clear();
    this.instances.clear();
    this.singletons.clear();
    this.factories.clear();
    this.loading.clear();
    
    console.log('✅ 의존성 매니저 정리 완료');
  }

  /**
   * 디버그 정보 출력
   */
  debug(): void {
    console.log('=== 의존성 매니저 디버그 정보 ===');
    console.log('등록된 서비스:', Array.from(this.factories.keys()));
    console.log('의존성 맵:');
    
    for (const [service, deps] of this.dependencies.entries()) {
      console.log(`  ${service} -> [${Array.from(deps).join(', ')}]`);
    }
    
    const analysis = this.analyzeDependencies();
    console.log('순환 참조:', analysis.circularDependencies);
    console.log('로딩 순서:', analysis.loadOrder);
    console.log('================================');
  }
}

/**
 * 서비스 등록 옵션
 */
export interface ServiceOptions {
  dependencies?: string[];
  singleton?: boolean;
  lazy?: boolean;
}

/**
 * 의존성 분석 결과
 */
export interface DependencyAnalysis {
  totalServices: number;
  circularDependencies: string[][];
  dependencyTree: DependencyTree;
  loadOrder: string[];
  hasCircularDependencies: boolean;
}

/**
 * 의존성 트리 구조
 */
export interface DependencyTree {
  [serviceName: string]: {
    dependencies: string[];
    dependents: string[];
    level: number;
  };
}

/**
 * 서비스 상태
 */
export interface ServiceStatus {
  registered: number;
  instantiated: number;
  loading: number;
  ready: number;
}

/**
 * 기본 서비스 인터페이스
 */
export interface Service {
  initialize?(): Promise<void> | void;
  cleanup?(): Promise<void> | void;
  setDependencies?(deps: Record<string, any>): void;
}

// 전역 의존성 매니저
let globalDependencyManager: DependencyManager | null = null;

/**
 * 전역 의존성 매니저 가져오기
 */
export function getDependencyManager(): DependencyManager {
  if (!globalDependencyManager) {
    globalDependencyManager = new DependencyManager();
  }
  return globalDependencyManager;
}

/**
 * 서비스 등록 데코레이터
 */
export function Injectable(name: string, options?: ServiceOptions) {
  return function <T extends new (...args: any[]) => any>(constructor: T) {
    const dependencyManager = getDependencyManager();
    
    dependencyManager.register(name, () => new constructor(), options);
    
    return constructor;
  };
}

/**
 * 의존성 주입 데코레이터
 */
export function Inject(serviceName: string) {
  return function (target: any, propertyKey: string) {
    // 프로퍼티 초기화 시 서비스 주입
    Object.defineProperty(target, propertyKey, {
      get: function () {
        const dependencyManager = getDependencyManager();
        return dependencyManager.resolve(serviceName);
      },
      configurable: true,
    });
  };
}

export default getDependencyManager;