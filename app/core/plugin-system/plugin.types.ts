/**
 * 플러그인 시스템 타입 정의
 * 
 * 이 파일은 플러그인 시스템에서 사용되는 모든 타입과 인터페이스를 정의합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ReactNode } from 'react';

/**
 * 플러그인 우선순위 열거형
 * 숫자가 낮을수록 높은 우선순위를 가집니다
 */
export enum PluginPriority {
  HIGHEST = 0,
  HIGH = 10,
  NORMAL = 50,
  LOW = 90,
  LOWEST = 100
}

/**
 * 플러그인 상태 열거형
 */
export enum PluginStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
  LOADING = 'loading'
}

/**
 * 훅 타입 정의
 * 시스템에서 사용 가능한 모든 훅 타입을 정의합니다
 */
export type HookType = 
  | 'pre_init'           // 초기화 전
  | 'post_init'          // 초기화 후
  | 'pre_render'         // 렌더링 전
  | 'post_render'        // 렌더링 후
  | 'pre_save'           // 저장 전
  | 'post_save'          // 저장 후
  | 'pre_delete'         // 삭제 전
  | 'post_delete'        // 삭제 후
  | 'pre_route'          // 라우트 처리 전
  | 'post_route'         // 라우트 처리 후
  | 'menu_register'      // 메뉴 등록
  | 'widget_register'    // 위젯 등록
  | 'filter_content'     // 콘텐츠 필터링
  | 'filter_title'       // 제목 필터링
  | 'user_login'         // 사용자 로그인
  | 'user_logout'        // 사용자 로그아웃
  | 'admin_menu'         // 관리자 메뉴
  | 'dashboard_widget';  // 대시보드 위젯

/**
 * 훅 콜백 함수 타입
 */
export type HookCallback<T = any, R = any> = (data: T) => R | Promise<R>;

/**
 * 훅 인터페이스
 */
export interface IHook<T = any, R = any> {
  /** 훅 이름 */
  name: HookType;
  /** 콜백 함수 */
  callback: HookCallback<T, R>;
  /** 우선순위 (낮을수록 먼저 실행) */
  priority?: number;
  /** 플러그인 ID */
  pluginId: string;
}

/**
 * 플러그인 메타데이터 인터페이스
 */
export interface IPluginMetadata {
  /** 플러그인 이름 */
  name: string;
  /** 플러그인 버전 */
  version: string;
  /** 플러그인 설명 */
  description: string;
  /** 플러그인 작성자 */
  author: string;
  /** 플러그인 라이센스 */
  license?: string;
  /** 플러그인 홈페이지 */
  homepage?: string;
  /** 필요한 CMS 최소 버전 */
  minCmsVersion?: string;
  /** 의존성 플러그인 목록 */
  dependencies?: string[];
  /** 플러그인 태그 */
  tags?: string[];
}

/**
 * 플러그인 설정 인터페이스
 */
export interface IPluginConfig {
  /** 플러그인 활성화 여부 */
  enabled: boolean;
  /** 플러그인 우선순위 */
  priority?: PluginPriority;
  /** 플러그인별 커스텀 설정 */
  settings?: Record<string, any>;
}

/**
 * 플러그인 라우트 정의
 */
export interface IPluginRoute {
  /** 라우트 경로 */
  path: string;
  /** HTTP 메서드 */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  /** 라우트 핸들러 */
  handler: (req: NextRequest) => Promise<NextResponse> | NextResponse;
  /** 미들웨어 (선택사항) */
  middleware?: Array<(req: NextRequest) => Promise<void> | void>;
}

/**
 * 플러그인 메뉴 아이템
 */
export interface IPluginMenuItem {
  /** 메뉴 ID */
  id: string;
  /** 메뉴 제목 */
  title: string;
  /** 메뉴 경로 */
  path: string;
  /** 메뉴 아이콘 (선택사항) */
  icon?: ReactNode | string;
  /** 부모 메뉴 ID (서브메뉴인 경우) */
  parentId?: string;
  /** 메뉴 순서 */
  order?: number;
  /** 권한 요구사항 */
  permissions?: string[];
}

/**
 * 플러그인 위젯 정의
 */
export interface IPluginWidget {
  /** 위젯 ID */
  id: string;
  /** 위젯 제목 */
  title: string;
  /** 위젯 컴포넌트 */
  component: () => ReactNode | Promise<ReactNode>;
  /** 위젯이 표시될 영역 */
  zone: 'dashboard' | 'sidebar' | 'header' | 'footer' | string;
  /** 위젯 크기 */
  size?: 'small' | 'medium' | 'large' | 'full';
  /** 위젯 순서 */
  order?: number;
}

/**
 * 플러그인 생명주기 메서드
 */
export interface IPluginLifecycle {
  /** 플러그인 활성화 시 호출 */
  onActivate?: () => Promise<void> | void;
  /** 플러그인 비활성화 시 호출 */
  onDeactivate?: () => Promise<void> | void;
  /** 플러그인 설치 시 호출 */
  onInstall?: () => Promise<void> | void;
  /** 플러그인 제거 시 호출 */
  onUninstall?: () => Promise<void> | void;
  /** 플러그인 업데이트 시 호출 */
  onUpdate?: (previousVersion: string) => Promise<void> | void;
}

/**
 * 기본 플러그인 인터페이스
 */
export interface IPlugin extends IPluginLifecycle {
  /** 플러그인 고유 ID */
  id: string;
  /** 플러그인 메타데이터 */
  metadata: IPluginMetadata;
  /** 플러그인 설정 */
  config?: IPluginConfig;
  /** 플러그인이 등록할 훅 목록 */
  hooks?: IHook[];
  /** 플러그인이 추가할 라우트 목록 */
  routes?: IPluginRoute[];
  /** 플러그인이 추가할 메뉴 아이템 목록 */
  menuItems?: IPluginMenuItem[];
  /** 플러그인이 추가할 위젯 목록 */
  widgets?: IPluginWidget[];
  /** 플러그인 초기화 메서드 */
  init?: () => Promise<void> | void;
  /** 플러그인 정리 메서드 */
  cleanup?: () => Promise<void> | void;
}

/**
 * 플러그인 컨텍스트
 * 플러그인이 시스템과 상호작용할 때 사용하는 컨텍스트
 */
export interface IPluginContext {
  /** 현재 플러그인 정보 */
  plugin: IPlugin;
  /** 데이터베이스 접근 */
  db: any; // TODO: 실제 DB 타입으로 교체
  /** 캐시 접근 */
  cache: any; // TODO: 실제 캐시 타입으로 교체
  /** 로거 */
  logger: {
    info: (message: string, ...args: any[]) => void;
    warn: (message: string, ...args: any[]) => void;
    error: (message: string, ...args: any[]) => void;
    debug: (message: string, ...args: any[]) => void;
  };
  /** 설정 접근 */
  getConfig: <T = any>(key: string) => T | undefined;
  /** 설정 저장 */
  setConfig: <T = any>(key: string, value: T) => Promise<void>;
  /** 다른 플러그인 접근 */
  getPlugin: (pluginId: string) => IPlugin | undefined;
  /** 훅 실행 */
  runHook: <T = any, R = any>(hookName: HookType, data: T) => Promise<R[]>;
}

/**
 * 플러그인 매니저 인터페이스
 */
export interface IPluginManager {
  /** 플러그인 등록 */
  register(plugin: IPlugin): Promise<void>;
  /** 플러그인 해제 */
  unregister(pluginId: string): Promise<void>;
  /** 플러그인 활성화 */
  activate(pluginId: string): Promise<void>;
  /** 플러그인 비활성화 */
  deactivate(pluginId: string): Promise<void>;
  /** 플러그인 가져오기 */
  getPlugin(pluginId: string): IPlugin | undefined;
  /** 모든 플러그인 가져오기 */
  getAllPlugins(): IPlugin[];
  /** 활성화된 플러그인 가져오기 */
  getActivePlugins(): IPlugin[];
  /** 플러그인 상태 가져오기 */
  getPluginStatus(pluginId: string): PluginStatus;
  /** 플러그인 설정 업데이트 */
  updateConfig(pluginId: string, config: Partial<IPluginConfig>): Promise<void>;
}

/**
 * 훅 시스템 인터페이스
 */
export interface IHookSystem {
  /** 훅 등록 */
  register<T = any, R = any>(hook: IHook<T, R>): void;
  /** 훅 해제 */
  unregister(hookName: HookType, pluginId: string): void;
  /** 훅 실행 */
  run<T = any, R = any>(hookName: HookType, data: T): Promise<R[]>;
  /** 특정 플러그인의 모든 훅 해제 */
  unregisterAll(pluginId: string): void;
  /** 등록된 훅 목록 가져오기 */
  getHooks(hookName?: HookType): IHook[];
}

/**
 * 플러그인 로더 인터페이스
 */
export interface IPluginLoader {
  /** 플러그인 디렉토리에서 플러그인 로드 */
  loadFromDirectory(directory: string): Promise<IPlugin[]>;
  /** 특정 플러그인 로드 */
  loadPlugin(pluginPath: string): Promise<IPlugin>;
  /** 플러그인 검증 */
  validatePlugin(plugin: any): plugin is IPlugin;
  /** 플러그인 의존성 확인 */
  checkDependencies(plugin: IPlugin): Promise<boolean>;
}

/**
 * 플러그인 이벤트 타입
 */
export type PluginEvent = 
  | 'plugin:registered'
  | 'plugin:unregistered'
  | 'plugin:activated'
  | 'plugin:deactivated'
  | 'plugin:error'
  | 'hook:registered'
  | 'hook:executed';

/**
 * 플러그인 이벤트 데이터
 */
export interface IPluginEventData {
  pluginId: string;
  event: PluginEvent;
  timestamp: Date;
  data?: any;
  error?: Error;
}