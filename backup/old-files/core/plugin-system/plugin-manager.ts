/**
 * 플러그인 생명주기 관리자
 * 
 * 이 파일은 플러그인의 전체 생명주기를 관리합니다.
 * 플러그인의 등록, 활성화, 비활성화, 설정 관리 등을 담당합니다.
 */

import {
  IPlugin,
  IPluginManager,
  IPluginConfig,
  PluginStatus,
  PluginPriority,
  IPluginContext,
  PluginEvent,
  IPluginEventData
} from './plugin.types';
import HookSystem from './hook-system';
import PluginLoader from './plugin-loader';
import { PluginIntegrationManager, type PluginRoute, type PluginMenuItem, type PluginWidget } from './integrations';
import { createPluginDatabaseClient } from './database-client';
import { createPluginCacheClient, initializeCache } from './cache-interface';
import { EventEmitter } from 'events';

/**
 * 플러그인 정보를 저장하는 내부 타입
 */
interface PluginInfo {
  plugin: IPlugin;
  status: PluginStatus;
  config: IPluginConfig;
  context?: IPluginContext;
}

/**
 * 플러그인 매니저 구현 클래스
 */
export class PluginManager extends EventEmitter implements IPluginManager {
  private static instance: PluginManager;
  private plugins: Map<string, PluginInfo>;
  private hookSystem: HookSystem;
  private loader: PluginLoader;
  private integrationManager: PluginIntegrationManager;
  private initialized: boolean;

  private constructor() {
    super();
    this.plugins = new Map();
    this.hookSystem = HookSystem.getInstance();
    this.loader = PluginLoader.getInstance();
    this.integrationManager = PluginIntegrationManager.getInstance();
    this.initialized = false;
    
    // 캐시 시스템 초기화
    initializeCache();
  }

  /**
   * 플러그인 매니저 인스턴스 가져오기
   */
  public static getInstance(): PluginManager {
    if (!PluginManager.instance) {
      PluginManager.instance = new PluginManager();
    }
    return PluginManager.instance;
  }

  /**
   * 플러그인 매니저 초기화
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('플러그인 매니저 초기화 중...');

    // 플러그인 디렉토리에서 플러그인 로드
    const pluginDir = process.env.PLUGIN_DIR || './app/plugins';
    const plugins = await this.loader.loadFromDirectory(pluginDir);

    // 로드된 플러그인들을 등록
    for (const plugin of plugins) {
      try {
        await this.register(plugin);
      } catch (error) {
        console.error(`플러그인 등록 실패: ${plugin.id}`, error);
      }
    }

    this.initialized = true;
    console.log('플러그인 매니저 초기화 완료');
  }

  /**
   * 플러그인 등록
   * 
   * @param plugin 등록할 플러그인
   */
  public async register(plugin: IPlugin): Promise<void> {
    // 이미 등록된 플러그인인지 확인
    if (this.plugins.has(plugin.id)) {
      throw new Error(`플러그인이 이미 등록되어 있습니다: ${plugin.id}`);
    }

    // 플러그인 의존성 확인
    const dependenciesOk = await this.loader.checkDependencies(plugin);
    if (!dependenciesOk) {
      throw new Error(`플러그인 의존성 확인 실패: ${plugin.id}`);
    }

    // 플러그인 정보 생성
    const pluginInfo: PluginInfo = {
      plugin,
      status: PluginStatus.INACTIVE,
      config: plugin.config || {
        enabled: false,
        priority: PluginPriority.NORMAL,
        settings: {}
      }
    };

    // 플러그인 컨텍스트 생성
    pluginInfo.context = this.createPluginContext(plugin);

    // 플러그인 등록
    this.plugins.set(plugin.id, pluginInfo);

    // 플러그인 설치 메서드 호출
    if (plugin.onInstall) {
      try {
        await plugin.onInstall();
      } catch (error) {
        console.error(`플러그인 설치 중 오류: ${plugin.id}`, error);
      }
    }

    // 이벤트 발생
    this.emitPluginEvent('plugin:registered', plugin.id);

    console.log(`플러그인 등록됨: ${plugin.id} (${plugin.metadata.name})`);

    // 설정에서 활성화되어 있으면 자동 활성화
    if (pluginInfo.config.enabled) {
      await this.activate(plugin.id);
    }
  }

  /**
   * 플러그인 해제
   * 
   * @param pluginId 해제할 플러그인 ID
   */
  public async unregister(pluginId: string): Promise<void> {
    const pluginInfo = this.plugins.get(pluginId);
    if (!pluginInfo) {
      throw new Error(`등록되지 않은 플러그인: ${pluginId}`);
    }

    // 활성화되어 있으면 먼저 비활성화
    if (pluginInfo.status === PluginStatus.ACTIVE) {
      await this.deactivate(pluginId);
    }

    // 플러그인 제거 메서드 호출
    if (pluginInfo.plugin.onUninstall) {
      try {
        await pluginInfo.plugin.onUninstall();
      } catch (error) {
        console.error(`플러그인 제거 중 오류: ${pluginId}`, error);
      }
    }

    // 플러그인의 모든 훅 제거
    this.hookSystem.unregisterAll(pluginId);

    // 플러그인 정보 삭제
    this.plugins.delete(pluginId);

    // 이벤트 발생
    this.emitPluginEvent('plugin:unregistered', pluginId);

    console.log(`플러그인 해제됨: ${pluginId}`);
  }

  /**
   * 플러그인 활성화
   * 
   * @param pluginId 활성화할 플러그인 ID
   */
  public async activate(pluginId: string): Promise<void> {
    const pluginInfo = this.plugins.get(pluginId);
    if (!pluginInfo) {
      throw new Error(`등록되지 않은 플러그인: ${pluginId}`);
    }

    if (pluginInfo.status === PluginStatus.ACTIVE) {
      console.warn(`플러그인이 이미 활성화되어 있습니다: ${pluginId}`);
      return;
    }

    pluginInfo.status = PluginStatus.LOADING;

    try {
      // 플러그인 초기화
      if (pluginInfo.plugin.init) {
        await pluginInfo.plugin.init();
      }

      // 플러그인 활성화 메서드 호출
      if (pluginInfo.plugin.onActivate) {
        await pluginInfo.plugin.onActivate();
      }

      // 플러그인 훅 등록
      if (pluginInfo.plugin.hooks) {
        for (const hook of pluginInfo.plugin.hooks) {
          this.hookSystem.register({
            ...hook,
            pluginId: pluginId
          });
        }
      }

      // 플러그인 통합 요소 등록 (라우트, 메뉴, 위젯)
      const integrations: {
        routes?: PluginRoute[];
        menuItems?: PluginMenuItem[];
        widgets?: PluginWidget[];
      } = {};

      // 플러그인 라우트를 통합 시스템용 형식으로 변환
      if (pluginInfo.plugin.routes && pluginInfo.plugin.routes.length > 0) {
        integrations.routes = pluginInfo.plugin.routes.map(route => ({
          path: route.path,
          component: `${pluginId}/${route.path}`,
          loader: route.middleware ? 'with-middleware' : undefined,
          permissions: ['plugin:' + pluginId]
        }));
        console.log(`플러그인 ${pluginId}의 ${integrations.routes.length}개 라우트 등록`);
      }

      // 플러그인 메뉴를 통합 시스템용 형식으로 변환
      if (pluginInfo.plugin.menuItems && pluginInfo.plugin.menuItems.length > 0) {
        integrations.menuItems = pluginInfo.plugin.menuItems.map(menuItem => ({
          id: `${pluginId}-${menuItem.id}`,
          label: menuItem.title,
          url: menuItem.path,
          icon: typeof menuItem.icon === 'string' ? menuItem.icon : undefined,
          order: menuItem.order || 100,
          permissions: menuItem.permissions || ['plugin:' + pluginId]
        }));
        console.log(`플러그인 ${pluginId}의 ${integrations.menuItems.length}개 메뉴 아이템 등록`);
      }

      // 플러그인 위젯을 통합 시스템용 형식으로 변환
      if (pluginInfo.plugin.widgets && pluginInfo.plugin.widgets.length > 0) {
        integrations.widgets = pluginInfo.plugin.widgets.map(widget => ({
          id: `${pluginId}-${widget.id}`,
          name: widget.title,
          description: `${pluginId} 플러그인의 ${widget.title} 위젯`,
          component: `${pluginId}/${widget.id}`,
          position: widget.zone === 'dashboard' ? 'content' : 
                   widget.zone === 'sidebar' ? 'sidebar' :
                   widget.zone === 'header' ? 'header' :
                   widget.zone === 'footer' ? 'footer' : 'content',
          order: widget.order || 100,
          permissions: ['plugin:' + pluginId]
        }));
        console.log(`플러그인 ${pluginId}의 ${integrations.widgets.length}개 위젯 등록`);
      }

      // 통합 시스템에 등록
      if (Object.keys(integrations).length > 0) {
        this.integrationManager.registerPlugin(pluginInfo.plugin, integrations);
      }

      pluginInfo.status = PluginStatus.ACTIVE;
      pluginInfo.config.enabled = true;

      // 이벤트 발생
      this.emitPluginEvent('plugin:activated', pluginId);

      console.log(`플러그인 활성화됨: ${pluginId}`);
    } catch (error) {
      pluginInfo.status = PluginStatus.ERROR;
      console.error(`플러그인 활성화 실패: ${pluginId}`, error);
      this.emitPluginEvent('plugin:error', pluginId, error as Error);
      throw error;
    }
  }

  /**
   * 플러그인 비활성화
   * 
   * @param pluginId 비활성화할 플러그인 ID
   */
  public async deactivate(pluginId: string): Promise<void> {
    const pluginInfo = this.plugins.get(pluginId);
    if (!pluginInfo) {
      throw new Error(`등록되지 않은 플러그인: ${pluginId}`);
    }

    if (pluginInfo.status !== PluginStatus.ACTIVE) {
      console.warn(`플러그인이 활성화되어 있지 않습니다: ${pluginId}`);
      return;
    }

    try {
      // 플러그인 정리 메서드 호출
      if (pluginInfo.plugin.cleanup) {
        await pluginInfo.plugin.cleanup();
      }

      // 플러그인 비활성화 메서드 호출
      if (pluginInfo.plugin.onDeactivate) {
        await pluginInfo.plugin.onDeactivate();
      }

      // 플러그인의 모든 훅 제거
      this.hookSystem.unregisterAll(pluginId);

      // 통합 시스템에서 플러그인 제거
      this.integrationManager.unregisterPlugin(pluginId);

      pluginInfo.status = PluginStatus.INACTIVE;
      pluginInfo.config.enabled = false;

      // 이벤트 발생
      this.emitPluginEvent('plugin:deactivated', pluginId);

      console.log(`플러그인 비활성화됨: ${pluginId}`);
    } catch (error) {
      console.error(`플러그인 비활성화 실패: ${pluginId}`, error);
      throw error;
    }
  }

  /**
   * 플러그인 가져오기
   * 
   * @param pluginId 플러그인 ID
   * @returns 플러그인 객체
   */
  public getPlugin(pluginId: string): IPlugin | undefined {
    const pluginInfo = this.plugins.get(pluginId);
    return pluginInfo?.plugin;
  }

  /**
   * 모든 플러그인 가져오기
   * 
   * @returns 모든 플러그인 배열
   */
  public getAllPlugins(): IPlugin[] {
    return Array.from(this.plugins.values()).map(info => info.plugin);
  }

  /**
   * 활성화된 플러그인 가져오기
   * 
   * @returns 활성화된 플러그인 배열
   */
  public getActivePlugins(): IPlugin[] {
    return Array.from(this.plugins.values())
      .filter(info => info.status === PluginStatus.ACTIVE)
      .map(info => info.plugin);
  }

  /**
   * 플러그인 상태 가져오기
   * 
   * @param pluginId 플러그인 ID
   * @returns 플러그인 상태
   */
  public getPluginStatus(pluginId: string): PluginStatus {
    const pluginInfo = this.plugins.get(pluginId);
    return pluginInfo?.status || PluginStatus.INACTIVE;
  }

  /**
   * 플러그인 설정 업데이트
   * 
   * @param pluginId 플러그인 ID
   * @param config 업데이트할 설정
   */
  public async updateConfig(pluginId: string, config: Partial<IPluginConfig>): Promise<void> {
    const pluginInfo = this.plugins.get(pluginId);
    if (!pluginInfo) {
      throw new Error(`등록되지 않은 플러그인: ${pluginId}`);
    }

    // 설정 병합
    pluginInfo.config = {
      ...pluginInfo.config,
      ...config
    };

    // 활성화 상태 변경이 필요한 경우
    if (config.enabled !== undefined) {
      if (config.enabled && pluginInfo.status === PluginStatus.INACTIVE) {
        await this.activate(pluginId);
      } else if (!config.enabled && pluginInfo.status === PluginStatus.ACTIVE) {
        await this.deactivate(pluginId);
      }
    }

    console.log(`플러그인 설정 업데이트됨: ${pluginId}`);
  }

  /**
   * 플러그인 컨텍스트 생성
   * 
   * @param plugin 플러그인
   * @returns 플러그인 컨텍스트
   */
  private createPluginContext(plugin: IPlugin): IPluginContext {
    return {
      plugin,
      db: createPluginDatabaseClient(plugin.id),
      cache: createPluginCacheClient(plugin.id),
      logger: {
        info: (message: string, ...args: any[]) => {
          console.log(`[${plugin.id}] ${message}`, ...args);
        },
        warn: (message: string, ...args: any[]) => {
          console.warn(`[${plugin.id}] ${message}`, ...args);
        },
        error: (message: string, ...args: any[]) => {
          console.error(`[${plugin.id}] ${message}`, ...args);
        },
        debug: (message: string, ...args: any[]) => {
          if (process.env.NODE_ENV === 'development') {
            console.debug(`[${plugin.id}] ${message}`, ...args);
          }
        }
      },
      getConfig: <T = any>(key: string): T | undefined => {
        const pluginInfo = this.plugins.get(plugin.id);
        return pluginInfo?.config.settings?.[key];
      },
      setConfig: async <T = any>(key: string, value: T): Promise<void> => {
        const pluginInfo = this.plugins.get(plugin.id);
        if (pluginInfo) {
          if (!pluginInfo.config.settings) {
            pluginInfo.config.settings = {};
          }
          pluginInfo.config.settings[key] = value;
          
          // 설정을 플러그인 데이터로 영구 저장
          const db = createPluginDatabaseClient(plugin.id);
          try {
            await db.pluginData.upsert({
              where: { pluginId_key: { pluginId: plugin.id, key: `config.${key}` } },
              update: { value },
              create: { 
                pluginId: plugin.id, 
                key: `config.${key}`, 
                value 
              }
            });
          } catch (error) {
            console.error(`설정 저장 실패 [${plugin.id}]:`, error);
          }
        }
      },
      getPlugin: (pluginId: string): IPlugin | undefined => {
        return this.getPlugin(pluginId);
      },
      runHook: async <T = any, R = any>(hookName: any, data: T): Promise<R[]> => {
        return this.hookSystem.run(hookName, data);
      }
    };
  }

  /**
   * 플러그인 이벤트 발생
   * 
   * @param event 이벤트 타입
   * @param pluginId 플러그인 ID
   * @param error 에러 (선택사항)
   */
  private emitPluginEvent(event: PluginEvent, pluginId: string, error?: Error): void {
    const eventData: IPluginEventData = {
      pluginId,
      event,
      timestamp: new Date(),
      error
    };

    this.emit(event, eventData);
  }

  /**
   * 플러그인 시스템 상태 정보
   */
  public getSystemStatus(): {
    totalPlugins: number;
    activePlugins: number;
    inactivePlugins: number;
    errorPlugins: number;
    hooks: ReturnType<HookSystem['getStatus']>;
  } {
    const statuses = Array.from(this.plugins.values()).map(info => info.status);

    return {
      totalPlugins: this.plugins.size,
      activePlugins: statuses.filter(s => s === PluginStatus.ACTIVE).length,
      inactivePlugins: statuses.filter(s => s === PluginStatus.INACTIVE).length,
      errorPlugins: statuses.filter(s => s === PluginStatus.ERROR).length,
      hooks: this.hookSystem.getStatus()
    };
  }
}

// 기본 내보내기
export default PluginManager;