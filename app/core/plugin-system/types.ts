/**
 * 강타입 플러그인 시스템 타입 정의
 * any 타입을 완전히 제거하고 타입 안전성 보장
 */

import type { PrismaClient } from '@prisma/client';

// 데이터베이스 타입 (Prisma 클라이언트)
export type DatabaseClient = PrismaClient;

// 캐시 인터페이스 정의
export interface CacheInterface {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  exists(key: string): Promise<boolean>;
  keys(pattern?: string): Promise<string[]>;
}

// 메모리 캐시 구현
export class MemoryCache implements CacheInterface {
  private cache = new Map<string, { value: unknown; expires?: number }>();
  
  async get<T = unknown>(key: string): Promise<T | null> {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (item.expires && Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value as T;
  }
  
  async set<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const expires = ttlSeconds ? Date.now() + (ttlSeconds * 1000) : undefined;
    this.cache.set(key, { value, expires });
  }
  
  async delete(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }
  
  async clear(): Promise<void> {
    this.cache.clear();
  }
  
  async exists(key: string): Promise<boolean> {
    const exists = this.cache.has(key);
    if (!exists) return false;
    
    const item = this.cache.get(key);
    if (item?.expires && Date.now() > item.expires) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }
  
  async keys(pattern?: string): Promise<string[]> {
    const keys = Array.from(this.cache.keys());
    if (!pattern) return keys;
    
    // 간단한 패턴 매칭 (와일드카드 지원)
    const regex = new RegExp(pattern.replace('*', '.*'));
    return keys.filter(key => regex.test(key));
  }
}

// 로거 인터페이스
export interface LoggerInterface {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
}

// 콘솔 로거 구현
export class ConsoleLogger implements LoggerInterface {
  info(message: string, ...args: unknown[]): void {
    console.log(`[INFO] ${message}`, ...args);
  }
  
  warn(message: string, ...args: unknown[]): void {
    console.warn(`[WARN] ${message}`, ...args);
  }
  
  error(message: string, ...args: unknown[]): void {
    console.error(`[ERROR] ${message}`, ...args);
  }
  
  debug(message: string, ...args: unknown[]): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }
}

// 설정 값 타입 정의
export type ConfigValue = 
  | string 
  | number 
  | boolean 
  | object 
  | Array<ConfigValue> 
  | null 
  | undefined;

// 설정 저장소 인터페이스
export interface ConfigStoreInterface {
  get<T extends ConfigValue = ConfigValue>(key: string): Promise<T | undefined>;
  set<T extends ConfigValue = ConfigValue>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  has(key: string): Promise<boolean>;
  keys(): Promise<string[]>;
}

// 메모리 설정 저장소
export class MemoryConfigStore implements ConfigStoreInterface {
  private store = new Map<string, ConfigValue>();
  
  async get<T extends ConfigValue = ConfigValue>(key: string): Promise<T | undefined> {
    return this.store.get(key) as T | undefined;
  }
  
  async set<T extends ConfigValue = ConfigValue>(key: string, value: T): Promise<void> {
    this.store.set(key, value);
  }
  
  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }
  
  async has(key: string): Promise<boolean> {
    return this.store.has(key);
  }
  
  async keys(): Promise<string[]> {
    return Array.from(this.store.keys());
  }
}

// 훅 데이터 타입 정의
export interface HookData {
  [key: string]: unknown;
}

// 특정 훅 타입들
export interface PostCreateHookData extends HookData {
  post: {
    id: string;
    title: string;
    content: string;
    authorId: string;
  };
}

export interface UserLoginHookData extends HookData {
  user: {
    id: string;
    username: string;
    email: string;
  };
  timestamp: Date;
}

export interface MenuCreateHookData extends HookData {
  menu: {
    id: string;
    name: string;
    slug: string;
  };
}

// 훅 결과 타입
export type HookResult<T = unknown> = T | Promise<T>;

// 훅 핸들러 타입
export type HookHandler<TInput extends HookData = HookData, TOutput = unknown> = 
  (data: TInput, context: IPluginContext) => HookResult<TOutput>;

// 훅 타입 정의 (타입 안전성을 위한 매핑)
export interface HookTypeMap {
  'post:create': { input: PostCreateHookData; output: void };
  'post:update': { input: PostCreateHookData; output: void };
  'post:delete': { input: { postId: string }; output: void };
  'user:login': { input: UserLoginHookData; output: void };
  'user:logout': { input: { userId: string }; output: void };
  'menu:create': { input: MenuCreateHookData; output: void };
  'admin:dashboard': { input: HookData; output: { widgets: unknown[] } };
}

export type HookType = keyof HookTypeMap;

// 플러그인 컨텍스트 (타입 안전성 강화)
export interface IPluginContext {
  /** 현재 플러그인 정보 */
  plugin: IPlugin;
  
  /** 데이터베이스 접근 */
  db: DatabaseClient;
  
  /** 캐시 접근 */
  cache: CacheInterface;
  
  /** 로거 */
  logger: LoggerInterface;
  
  /** 설정 접근 */
  configStore: ConfigStoreInterface;
  
  /** 설정 접근 헬퍼 */
  getConfig: <T extends ConfigValue = ConfigValue>(key: string) => Promise<T | undefined>;
  
  /** 설정 저장 헬퍼 */
  setConfig: <T extends ConfigValue = ConfigValue>(key: string, value: T) => Promise<void>;
  
  /** 다른 플러그인 접근 */
  getPlugin: (pluginId: string) => IPlugin | undefined;
  
  /** 타입 안전 훅 실행 */
  runHook: <T extends HookType>(
    hookName: T, 
    data: HookTypeMap[T]['input']
  ) => Promise<HookTypeMap[T]['output'][]>;
}

// 나머지 인터페이스들은 기존 plugin.types.ts에서 가져와서 any 제거
export enum PluginStatus {
  INACTIVE = 'inactive',
  ACTIVE = 'active',
  ERROR = 'error',
  DISABLED = 'disabled'
}

export enum PluginPriority {
  LOW = 1,
  NORMAL = 5,
  HIGH = 10,
  CRITICAL = 20
}

export interface IPluginMetadata {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  homepage?: string;
  license?: string;
  keywords?: string[];
  dependencies?: Record<string, string>;
  engines?: {
    node?: string;
    cms?: string;
  };
}

export interface IPluginConfig {
  enabled: boolean;
  priority: PluginPriority;
  settings: Record<string, ConfigValue>;
}

export interface IPlugin {
  readonly metadata: IPluginMetadata;
  initialize?: (context: IPluginContext) => Promise<void> | void;
  activate?: (context: IPluginContext) => Promise<void> | void;
  deactivate?: (context: IPluginContext) => Promise<void> | void;
  cleanup?: () => Promise<void> | void;
}

// 플러그인 매니저 관련 인터페이스
export interface IPluginManager {
  initialize(): Promise<void>;
  register(plugin: IPlugin): Promise<void>;
  unregister(pluginId: string): Promise<void>;
  activate(pluginId: string): Promise<void>;
  deactivate(pluginId: string): Promise<void>;
  getPlugin(pluginId: string): IPlugin | undefined;
  getActivePlugins(): IPlugin[];
  getAllPlugins(): IPlugin[];
  isActive(pluginId: string): boolean;
}

export interface IPluginLoader {
  loadFromDirectory(directory: string): Promise<IPlugin[]>;
  loadFromFile(filePath: string): Promise<IPlugin>;
  validatePlugin(plugin: IPlugin): boolean;
  checkDependencies(plugin: IPlugin): Promise<boolean>;
}