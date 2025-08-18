/**
 * 이벤트 기반 훅 시스템
 * 
 * 이 파일은 플러그인들이 시스템의 다양한 지점에서 코드를 실행할 수 있도록
 * 하는 훅 시스템을 구현합니다. WordPress의 액션/필터 시스템과 유사한 개념입니다.
 */

import { IHook, IHookSystem, HookType } from './plugin.types';

/**
 * 훅 시스템 구현 클래스
 * 
 * 싱글톤 패턴으로 구현되어 애플리케이션 전체에서 하나의 인스턴스만 사용됩니다.
 */
export class HookSystem implements IHookSystem {
  private static instance: HookSystem;
  private hooks: Map<HookType, IHook[]>;

  private constructor() {
    this.hooks = new Map();
  }

  /**
   * 훅 시스템 인스턴스 가져오기
   */
  public static getInstance(): HookSystem {
    if (!HookSystem.instance) {
      HookSystem.instance = new HookSystem();
    }
    return HookSystem.instance;
  }

  /**
   * 훅 등록
   * 
   * @param hook 등록할 훅 객체
   */
  public register<T = any, R = any>(hook: IHook<T, R>): void {
    // 해당 훅 타입의 배열이 없으면 생성
    if (!this.hooks.has(hook.name)) {
      this.hooks.set(hook.name, []);
    }

    const hooks = this.hooks.get(hook.name)!;
    
    // 중복 등록 방지
    const existingIndex = hooks.findIndex(
      h => h.pluginId === hook.pluginId && h.callback === hook.callback
    );
    
    if (existingIndex !== -1) {
      console.warn(
        `훅이 이미 등록되어 있습니다: ${hook.name} (플러그인: ${hook.pluginId})`
      );
      return;
    }

    // 훅 추가
    hooks.push({
      ...hook,
      priority: hook.priority ?? 50 // 기본 우선순위 50
    });

    // 우선순위 순으로 정렬 (낮은 숫자가 먼저 실행)
    hooks.sort((a, b) => (a.priority ?? 50) - (b.priority ?? 50));

    console.log(
      `훅 등록됨: ${hook.name} (플러그인: ${hook.pluginId}, 우선순위: ${hook.priority ?? 50})`
    );
  }

  /**
   * 특정 훅 해제
   * 
   * @param hookName 훅 이름
   * @param pluginId 플러그인 ID
   */
  public unregister(hookName: HookType, pluginId: string): void {
    const hooks = this.hooks.get(hookName);
    if (!hooks) {
      return;
    }

    const filteredHooks = hooks.filter(h => h.pluginId !== pluginId);
    
    if (filteredHooks.length === 0) {
      this.hooks.delete(hookName);
    } else {
      this.hooks.set(hookName, filteredHooks);
    }

    console.log(`훅 해제됨: ${hookName} (플러그인: ${pluginId})`);
  }

  /**
   * 특정 플러그인의 모든 훅 해제
   * 
   * @param pluginId 플러그인 ID
   */
  public unregisterAll(pluginId: string): void {
    let removedCount = 0;

    for (const [hookName, hooks] of this.hooks.entries()) {
      const filteredHooks = hooks.filter(h => h.pluginId !== pluginId);
      
      if (filteredHooks.length !== hooks.length) {
        removedCount += hooks.length - filteredHooks.length;
        
        if (filteredHooks.length === 0) {
          this.hooks.delete(hookName);
        } else {
          this.hooks.set(hookName, filteredHooks);
        }
      }
    }

    console.log(`플러그인 ${pluginId}의 모든 훅 해제됨 (총 ${removedCount}개)`);
  }

  /**
   * 훅 실행
   * 
   * @param hookName 실행할 훅 이름
   * @param data 훅에 전달할 데이터
   * @returns 각 훅 콜백의 반환값 배열
   */
  public async run<T = any, R = any>(hookName: HookType, data: T): Promise<R[]> {
    const hooks = this.hooks.get(hookName);
    if (!hooks || hooks.length === 0) {
      return [];
    }

    console.log(`훅 실행 시작: ${hookName} (등록된 훅: ${hooks.length}개)`);

    const results: R[] = [];
    let processedData = data;

    for (const hook of hooks) {
      try {
        // 훅 실행
        const result = await hook.callback(processedData);
        results.push(result);

        // 필터 타입 훅의 경우 결과를 다음 훅에 전달
        if (hookName.startsWith('filter_') && result !== undefined) {
          processedData = result as any;
        }
      } catch (error) {
        console.error(
          `훅 실행 중 오류 발생: ${hookName} (플러그인: ${hook.pluginId})`,
          error
        );
        // 오류가 발생해도 다른 훅은 계속 실행
      }
    }

    console.log(`훅 실행 완료: ${hookName}`);
    return results;
  }

  /**
   * 등록된 훅 목록 가져오기
   * 
   * @param hookName 특정 훅 이름 (선택사항)
   * @returns 훅 목록
   */
  public getHooks(hookName?: HookType): IHook[] {
    if (hookName) {
      return this.hooks.get(hookName) || [];
    }

    // 모든 훅 반환
    const allHooks: IHook[] = [];
    for (const hooks of this.hooks.values()) {
      allHooks.push(...hooks);
    }
    return allHooks;
  }

  /**
   * 훅 시스템 상태 정보 가져오기
   */
  public getStatus(): {
    totalHooks: number;
    hookTypes: HookType[];
    hooksByType: Record<HookType, number>;
  } {
    const hooksByType: Record<string, number> = {};
    let totalHooks = 0;

    for (const [hookName, hooks] of this.hooks.entries()) {
      hooksByType[hookName] = hooks.length;
      totalHooks += hooks.length;
    }

    return {
      totalHooks,
      hookTypes: Array.from(this.hooks.keys()),
      hooksByType: hooksByType as Record<HookType, number>
    };
  }

  /**
   * 훅 시스템 초기화 (테스트 용도)
   */
  public clear(): void {
    this.hooks.clear();
    console.log('훅 시스템이 초기화되었습니다');
  }
}

/**
 * 훅 시스템 헬퍼 함수들
 */

/**
 * 액션 훅 실행 (반환값 없음)
 */
export async function doAction<T = any>(hookName: HookType, data: T): Promise<void> {
  const hookSystem = HookSystem.getInstance();
  await hookSystem.run(hookName, data);
}

/**
 * 필터 훅 실행 (마지막 반환값 사용)
 */
export async function applyFilter<T = any>(hookName: HookType, data: T): Promise<T> {
  const hookSystem = HookSystem.getInstance();
  const results = await hookSystem.run<T, T>(hookName, data);
  
  // 필터의 경우 마지막 결과를 반환 (체인 방식)
  return results.length > 0 ? results[results.length - 1] : data;
}

/**
 * 훅 등록 헬퍼
 */
export function addHook<T = any, R = any>(
  name: HookType,
  callback: (data: T) => R | Promise<R>,
  pluginId: string,
  priority?: number
): void {
  const hookSystem = HookSystem.getInstance();
  hookSystem.register({
    name,
    callback,
    pluginId,
    priority
  });
}

/**
 * 훅 제거 헬퍼
 */
export function removeHook(name: HookType, pluginId: string): void {
  const hookSystem = HookSystem.getInstance();
  hookSystem.unregister(name, pluginId);
}

/**
 * 플러그인의 모든 훅 제거 헬퍼
 */
export function removeAllHooks(pluginId: string): void {
  const hookSystem = HookSystem.getInstance();
  hookSystem.unregisterAll(pluginId);
}

// 기본 내보내기
export default HookSystem;