// 플러그인 시스템 타입 정의

export interface PluginMetadata {
  name: string;
  version: string;
  description: string;
  author: string;
  homepage?: string;
  license?: string;
  keywords?: string[];
  dependencies?: Record<string, string>;
  engines?: {
    node?: string;
    'blee-cms'?: string;
  };
  blee: {
    apiVersion: string;
    hooks?: string[];
    permissions?: string[];
    routes?: string[];
    components?: string[];
  };
}

export interface Plugin {
  metadata: PluginMetadata;
  initialize?(): Promise<void>;
  activate?(): Promise<void>;
  deactivate?(): Promise<void>;
  cleanup?(): Promise<void>;
  hooks?: Record<string, PluginHookHandler>;
}

export type PluginHook = 
  | 'beforeRequest'
  | 'afterRequest'
  | 'beforeRender'
  | 'afterRender'
  | 'beforeSave'
  | 'afterSave'
  | 'beforeDelete'
  | 'afterDelete'
  | 'beforePublish'
  | 'afterPublish'
  | 'beforeAuth'
  | 'afterAuth'
  | 'beforeUpload'
  | 'afterUpload'
  | 'onError'
  | 'onInit'
  | 'onShutdown';

export type PluginHookHandler = (context: PluginHookContext) => Promise<void> | void;

export interface PluginHookContext {
  type: PluginHook;
  pluginId: string;
  data?: any;
  request?: Request;
  response?: Response;
  error?: Error;
  user?: any;
  timestamp: Date;
}

export interface PluginConfig {
  enabled: boolean;
  settings?: Record<string, any>;
  permissions?: string[];
  priority?: number;
}

export interface PluginAPI {
  // 데이터베이스 접근
  db: {
    query: (sql: string, params?: any[]) => Promise<any>;
    transaction: (callback: () => Promise<void>) => Promise<void>;
  };
  
  // 캐시 접근
  cache: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any, ttl?: number) => Promise<void>;
    delete: (key: string) => Promise<void>;
  };
  
  // 이벤트 시스템
  events: {
    emit: (event: string, data: any) => void;
    on: (event: string, handler: (data: any) => void) => void;
    off: (event: string, handler: (data: any) => void) => void;
  };
  
  // 로깅
  logger: {
    info: (message: string, data?: any) => void;
    warn: (message: string, data?: any) => void;
    error: (message: string, error?: Error) => void;
    debug: (message: string, data?: any) => void;
  };
  
  // 설정
  config: {
    get: (key: string) => any;
    set: (key: string, value: any) => void;
  };
  
  // 유틸리티
  utils: {
    generateId: () => string;
    hash: (data: string) => string;
    encrypt: (data: string) => string;
    decrypt: (data: string) => string;
  };
}

export interface PluginRoute {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  handler: (request: Request) => Promise<Response>;
  middleware?: Array<(request: Request, next: () => Promise<Response>) => Promise<Response>>;
}

export interface PluginComponent {
  name: string;
  component: React.ComponentType<any>;
  props?: Record<string, any>;
  slots?: string[];
}

export interface PluginPermission {
  name: string;
  description: string;
  resource: string;
  actions: string[];
}

export interface PluginEvent {
  name: string;
  description: string;
  payload?: Record<string, any>;
}

export interface PluginLifecycle {
  onInstall?: () => Promise<void>;
  onUninstall?: () => Promise<void>;
  onUpdate?: (previousVersion: string, currentVersion: string) => Promise<void>;
  onEnable?: () => Promise<void>;
  onDisable?: () => Promise<void>;
}