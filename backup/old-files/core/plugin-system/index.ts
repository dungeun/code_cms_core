/**
 * 플러그인 시스템 메인 진입점
 * 
 * 이 파일은 플러그인 시스템의 모든 주요 컴포넌트를 내보내고
 * 플러그인 시스템을 쉽게 사용할 수 있도록 합니다.
 */

// 타입 정의 내보내기
export * from './plugin.types';

// 핵심 클래스들 내보내기
export { default as PluginManager } from './plugin-manager';
export { default as HookSystem } from './hook-system';
export { default as PluginLoader } from './plugin-loader';

// 헬퍼 함수들 내보내기
export {
  doAction,
  applyFilter,
  addHook,
  removeHook,
  removeAllHooks
} from './hook-system';

// 싱글톤 인스턴스 접근을 위한 헬퍼 함수들
import PluginManager from './plugin-manager';
import HookSystem from './hook-system';
import PluginLoader from './plugin-loader';

/**
 * 플러그인 매니저 인스턴스 가져오기
 */
export function getPluginManager(): PluginManager {
  return PluginManager.getInstance();
}

/**
 * 훅 시스템 인스턴스 가져오기
 */
export function getHookSystem(): HookSystem {
  return HookSystem.getInstance();
}

/**
 * 플러그인 로더 인스턴스 가져오기
 */
export function getPluginLoader(): PluginLoader {
  return PluginLoader.getInstance();
}

/**
 * 플러그인 시스템 초기화
 * 애플리케이션 시작 시 호출해야 합니다
 */
export async function initializePluginSystem(): Promise<void> {
  const manager = getPluginManager();
  await manager.initialize();
}

/**
 * 플러그인 시스템 상태 정보 가져오기
 */
export function getPluginSystemStatus() {
  const manager = getPluginManager();
  return manager.getSystemStatus();
}

/**
 * 활성 플러그인 목록 가져오기
 */
export function getActivePlugins() {
  const manager = getPluginManager();
  return manager.getActivePlugins();
}

/**
 * 플러그인 활성화/비활성화 토글
 */
export async function togglePlugin(pluginId: string): Promise<boolean> {
  const manager = getPluginManager();
  const status = manager.getPluginStatus(pluginId);
  
  if (status === 'active') {
    await manager.deactivate(pluginId);
    return false;
  } else {
    await manager.activate(pluginId);
    return true;
  }
}