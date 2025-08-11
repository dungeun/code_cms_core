// 플러그인 매니저 시스템

import { 
  Plugin, 
  PluginHook, 
  PluginHookContext, 
  PluginHookHandler,
  PluginAPI,
  PluginConfig,
  PluginRoute,
  PluginComponent 
} from './types';
import { EventEmitter } from 'events';
import crypto from 'crypto';

export class PluginManager extends EventEmitter {
  private hooks: Map<PluginHook, Map<string, PluginHookHandler>>;
  private plugins: Map<string, Plugin>;
  private configs: Map<string, PluginConfig>;
  private routes: Map<string, PluginRoute[]>;
  private components: Map<string, PluginComponent>;
  private api: PluginAPI;

  constructor() {
    super();
    this.hooks = new Map();
    this.plugins = new Map();
    this.configs = new Map();
    this.routes = new Map();
    this.components = new Map();
    this.api = this.createPluginAPI();
    
    // 모든 훅 타입 초기화
    const hookTypes: PluginHook[] = [
      'beforeRequest', 'afterRequest',
      'beforeRender', 'afterRender',
      'beforeSave', 'afterSave',
      'beforeDelete', 'afterDelete',
      'beforePublish', 'afterPublish',
      'beforeAuth', 'afterAuth',
      'beforeUpload', 'afterUpload',
      'onError', 'onInit', 'onShutdown'
    ];
    
    hookTypes.forEach(hook => {
      this.hooks.set(hook, new Map());
    });
  }

  // 플러그인 API 생성
  private createPluginAPI(): PluginAPI {
    return {
      db: {
        query: async (sql: string, params?: any[]) => {
          // 실제 구현에서는 데이터베이스 쿼리 실행
          console.log('Plugin DB query:', sql, params);
          return [];
        },
        transaction: async (callback: () => Promise<void>) => {
          // 실제 구현에서는 트랜잭션 처리
          await callback();
        }
      },
      
      cache: {
        get: async (key: string) => {
          // 실제 구현에서는 캐시에서 값 조회
          return null;
        },
        set: async (key: string, value: any, ttl?: number) => {
          // 실제 구현에서는 캐시에 값 저장
          console.log('Cache set:', key, value, ttl);
        },
        delete: async (key: string) => {
          // 실제 구현에서는 캐시에서 값 삭제
          console.log('Cache delete:', key);
        }
      },
      
      events: {
        emit: (event: string, data: any) => {
          this.emit(`plugin:${event}`, data);
        },
        on: (event: string, handler: (data: any) => void) => {
          this.on(`plugin:${event}`, handler);
        },
        off: (event: string, handler: (data: any) => void) => {
          this.off(`plugin:${event}`, handler);
        }
      },
      
      logger: {
        info: (message: string, data?: any) => {
          console.log(`[PLUGIN INFO] ${message}`, data);
        },
        warn: (message: string, data?: any) => {
          console.warn(`[PLUGIN WARN] ${message}`, data);
        },
        error: (message: string, error?: Error) => {
          console.error(`[PLUGIN ERROR] ${message}`, error);
        },
        debug: (message: string, data?: any) => {
          if (process.env.NODE_ENV === 'development') {
            console.debug(`[PLUGIN DEBUG] ${message}`, data);
          }
        }
      },
      
      config: {
        get: (key: string) => {
          // 실제 구현에서는 설정 값 조회
          return process.env[key];
        },
        set: (key: string, value: any) => {
          // 실제 구현에서는 설정 값 저장
          console.log('Config set:', key, value);
        }
      },
      
      utils: {
        generateId: () => {
          return crypto.randomUUID();
        },
        hash: (data: string) => {
          return crypto.createHash('sha256').update(data).digest('hex');
        },
        encrypt: (data: string) => {
          // 실제 구현에서는 암호화 처리
          return Buffer.from(data).toString('base64');
        },
        decrypt: (data: string) => {
          // 실제 구현에서는 복호화 처리
          return Buffer.from(data, 'base64').toString('utf-8');
        }
      }
    };
  }

  // 훅 추가
  addHook(hook: PluginHook, handler: PluginHookHandler, pluginId: string): void {
    const hookHandlers = this.hooks.get(hook);
    if (hookHandlers) {
      hookHandlers.set(pluginId, handler);
      this.api.logger.debug(`Hook added: ${hook} for plugin ${pluginId}`);
    }
  }

  // 훅 제거
  removeHook(hook: PluginHook, pluginId: string): void {
    const hookHandlers = this.hooks.get(hook);
    if (hookHandlers) {
      hookHandlers.delete(pluginId);
      this.api.logger.debug(`Hook removed: ${hook} for plugin ${pluginId}`);
    }
  }

  // 플러그인의 모든 훅 제거
  removePluginHooks(pluginId: string): void {
    this.hooks.forEach((handlers, hook) => {
      handlers.delete(pluginId);
    });
    this.api.logger.debug(`All hooks removed for plugin ${pluginId}`);
  }

  // 훅 실행
  async executeHook(hook: PluginHook, context: Omit<PluginHookContext, 'type' | 'pluginId' | 'timestamp'>): Promise<void> {
    const hookHandlers = this.hooks.get(hook);
    if (!hookHandlers || hookHandlers.size === 0) {
      return;
    }

    // 우선순위에 따라 정렬
    const sortedHandlers = Array.from(hookHandlers.entries()).sort((a, b) => {
      const configA = this.configs.get(a[0]);
      const configB = this.configs.get(b[0]);
      const priorityA = configA?.priority || 0;
      const priorityB = configB?.priority || 0;
      return priorityB - priorityA;
    });

    for (const [pluginId, handler] of sortedHandlers) {
      const config = this.configs.get(pluginId);
      if (!config?.enabled) continue;

      try {
        const fullContext: PluginHookContext = {
          ...context,
          type: hook,
          pluginId,
          timestamp: new Date()
        };
        
        await handler(fullContext);
      } catch (error) {
        this.api.logger.error(`Hook execution failed for ${pluginId} on ${hook}`, error as Error);
        
        // 에러 훅 실행 (무한 루프 방지)
        if (hook !== 'onError') {
          await this.executeHook('onError', {
            error: error as Error,
            data: { originalHook: hook, pluginId }
          });
        }
      }
    }
  }

  // 플러그인 등록
  registerPlugin(pluginId: string, plugin: Plugin, config?: PluginConfig): void {
    this.plugins.set(pluginId, plugin);
    this.configs.set(pluginId, config || {
      enabled: true,
      priority: 0
    });
    
    this.api.logger.info(`Plugin registered: ${pluginId}`);
  }

  // 플러그인 제거
  unregisterPlugin(pluginId: string): void {
    this.plugins.delete(pluginId);
    this.configs.delete(pluginId);
    this.removePluginHooks(pluginId);
    
    // 라우트 제거
    this.routes.forEach((routes, path) => {
      const filtered = routes.filter(route => !route.path.includes(pluginId));
      if (filtered.length === 0) {
        this.routes.delete(path);
      } else {
        this.routes.set(path, filtered);
      }
    });
    
    // 컴포넌트 제거
    const componentsToRemove: string[] = [];
    this.components.forEach((component, name) => {
      if (name.startsWith(`${pluginId}:`)) {
        componentsToRemove.push(name);
      }
    });
    componentsToRemove.forEach(name => this.components.delete(name));
    
    this.api.logger.info(`Plugin unregistered: ${pluginId}`);
  }

  // 플러그인 설정 업데이트
  updatePluginConfig(pluginId: string, config: Partial<PluginConfig>): void {
    const existingConfig = this.configs.get(pluginId);
    if (existingConfig) {
      this.configs.set(pluginId, { ...existingConfig, ...config });
      this.api.logger.info(`Plugin config updated: ${pluginId}`);
    }
  }

  // 플러그인 활성화
  async enablePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    const config = this.configs.get(pluginId);
    
    if (!plugin || !config) {
      throw new Error(`Plugin ${pluginId} not found`);
    }
    
    config.enabled = true;
    
    if (plugin.activate) {
      await plugin.activate();
    }
    
    this.api.logger.info(`Plugin enabled: ${pluginId}`);
  }

  // 플러그인 비활성화
  async disablePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    const config = this.configs.get(pluginId);
    
    if (!plugin || !config) {
      throw new Error(`Plugin ${pluginId} not found`);
    }
    
    config.enabled = false;
    
    if (plugin.deactivate) {
      await plugin.deactivate();
    }
    
    this.api.logger.info(`Plugin disabled: ${pluginId}`);
  }

  // 라우트 추가
  addRoute(pluginId: string, route: PluginRoute): void {
    const routes = this.routes.get(route.path) || [];
    routes.push(route);
    this.routes.set(route.path, routes);
    this.api.logger.debug(`Route added: ${route.method} ${route.path} for plugin ${pluginId}`);
  }

  // 컴포넌트 추가
  addComponent(pluginId: string, name: string, component: PluginComponent): void {
    const componentName = `${pluginId}:${name}`;
    this.components.set(componentName, component);
    this.api.logger.debug(`Component added: ${componentName}`);
  }

  // 플러그인 상태 조회
  getPluginStatus(pluginId: string): { enabled: boolean; plugin?: Plugin; config?: PluginConfig } {
    const plugin = this.plugins.get(pluginId);
    const config = this.configs.get(pluginId);
    
    return {
      enabled: config?.enabled || false,
      plugin,
      config
    };
  }

  // 모든 플러그인 조회
  getAllPlugins(): Map<string, Plugin> {
    return new Map(this.plugins);
  }

  // 활성화된 플러그인 조회
  getEnabledPlugins(): Map<string, Plugin> {
    const enabled = new Map<string, Plugin>();
    
    this.plugins.forEach((plugin, id) => {
      const config = this.configs.get(id);
      if (config?.enabled) {
        enabled.set(id, plugin);
      }
    });
    
    return enabled;
  }

  // API 접근
  getAPI(): PluginAPI {
    return this.api;
  }

  // 시스템 초기화
  async initialize(): Promise<void> {
    this.api.logger.info('Plugin manager initializing...');
    
    // 초기화 훅 실행
    await this.executeHook('onInit', {});
    
    // 모든 활성화된 플러그인 초기화
    for (const [pluginId, plugin] of this.plugins) {
      const config = this.configs.get(pluginId);
      if (config?.enabled && plugin.initialize) {
        try {
          await plugin.initialize();
          this.api.logger.info(`Plugin initialized: ${pluginId}`);
        } catch (error) {
          this.api.logger.error(`Failed to initialize plugin ${pluginId}`, error as Error);
        }
      }
    }
    
    this.api.logger.info('Plugin manager initialized');
  }

  // 시스템 종료
  async shutdown(): Promise<void> {
    this.api.logger.info('Plugin manager shutting down...');
    
    // 종료 훅 실행
    await this.executeHook('onShutdown', {});
    
    // 모든 플러그인 정리
    for (const [pluginId, plugin] of this.plugins) {
      if (plugin.cleanup) {
        try {
          await plugin.cleanup();
          this.api.logger.info(`Plugin cleaned up: ${pluginId}`);
        } catch (error) {
          this.api.logger.error(`Failed to cleanup plugin ${pluginId}`, error as Error);
        }
      }
    }
    
    // 모든 리스너 제거
    this.removeAllListeners();
    
    this.api.logger.info('Plugin manager shut down');
  }
}

// 싱글톤 인스턴스
export const pluginManager = new PluginManager();