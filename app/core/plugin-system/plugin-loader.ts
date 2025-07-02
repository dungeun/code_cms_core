/**
 * 동적 플러그인 로더
 * 
 * 이 파일은 플러그인을 동적으로 로드하고 검증하는 기능을 제공합니다.
 * 파일 시스템에서 플러그인을 읽어 메모리에 로드하고 초기화합니다.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { IPlugin, IPluginLoader, IPluginMetadata } from './plugin.types';

/**
 * 플러그인 로더 구현 클래스
 */
export class PluginLoader implements IPluginLoader {
  private static instance: PluginLoader;
  private loadedPlugins: Map<string, IPlugin>;

  private constructor() {
    this.loadedPlugins = new Map();
  }

  /**
   * 플러그인 로더 인스턴스 가져오기
   */
  public static getInstance(): PluginLoader {
    if (!PluginLoader.instance) {
      PluginLoader.instance = new PluginLoader();
    }
    return PluginLoader.instance;
  }

  /**
   * 플러그인 디렉토리에서 모든 플러그인 로드
   * 
   * @param directory 플러그인 디렉토리 경로
   * @returns 로드된 플러그인 배열
   */
  public async loadFromDirectory(directory: string): Promise<IPlugin[]> {
    try {
      // 디렉토리 존재 여부 확인
      const stats = await fs.stat(directory);
      if (!stats.isDirectory()) {
        throw new Error(`${directory}는 디렉토리가 아닙니다`);
      }

      // 디렉토리 내의 모든 항목 읽기
      const entries = await fs.readdir(directory, { withFileTypes: true });
      const plugins: IPlugin[] = [];

      // 각 하위 디렉토리를 플러그인으로 간주
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const pluginPath = path.join(directory, entry.name);
          
          try {
            const plugin = await this.loadPlugin(pluginPath);
            if (plugin) {
              plugins.push(plugin);
              this.loadedPlugins.set(plugin.id, plugin);
            }
          } catch (error) {
            console.error(`플러그인 로드 실패: ${entry.name}`, error);
          }
        }
      }

      console.log(`총 ${plugins.length}개의 플러그인이 로드되었습니다`);
      return plugins;
    } catch (error) {
      console.error(`플러그인 디렉토리 로드 실패: ${directory}`, error);
      return [];
    }
  }

  /**
   * 특정 플러그인 로드
   * 
   * @param pluginPath 플러그인 경로
   * @returns 로드된 플러그인 또는 null
   */
  public async loadPlugin(pluginPath: string): Promise<IPlugin> {
    try {
      // 플러그인 메인 파일 경로들
      const possibleMainFiles = [
        'index.ts',
        'index.js',
        'plugin.ts',
        'plugin.js',
        'main.ts',
        'main.js'
      ];

      let pluginModule: any = null;
      let mainFile: string | null = null;

      // 가능한 메인 파일들을 순서대로 확인
      for (const file of possibleMainFiles) {
        const filePath = path.join(pluginPath, file);
        
        try {
          await fs.access(filePath);
          mainFile = filePath;
          break;
        } catch {
          // 파일이 없으면 다음 파일 확인
          continue;
        }
      }

      if (!mainFile) {
        throw new Error(`플러그인 메인 파일을 찾을 수 없습니다: ${pluginPath}`);
      }

      // 동적 import 사용 (Next.js 환경에서)
      try {
        // 개발 환경에서는 require 사용 (동적 import가 제한적일 수 있음)
        if (process.env.NODE_ENV === 'development') {
          // TypeScript 파일인 경우 ts-node나 esbuild가 필요
          if (mainFile.endsWith('.ts')) {
            // TypeScript 파일은 빌드 시스템에서 처리하도록 함
            console.warn(`TypeScript 플러그인은 빌드 후 로드해야 합니다: ${mainFile}`);
            throw new Error('TypeScript 플러그인 직접 로드 불가');
          }
          
          // JavaScript 파일만 로드
          delete require.cache[require.resolve(mainFile)];
          pluginModule = require(mainFile);
        } else {
          // 프로덕션에서는 빌드된 파일만 로드
          const builtPath = mainFile.replace(/\.ts$/, '.js');
          pluginModule = await import(builtPath);
        }
      } catch (error) {
        console.error(`플러그인 모듈 로드 실패: ${mainFile}`, error);
        throw error;
      }

      // 플러그인 객체 추출
      const plugin = pluginModule.default || pluginModule;

      // 플러그인 검증
      if (!this.validatePlugin(plugin)) {
        throw new Error(`유효하지 않은 플러그인 형식: ${pluginPath}`);
      }

      // 플러그인 ID가 없으면 디렉토리 이름 사용
      if (!plugin.id) {
        plugin.id = path.basename(pluginPath);
      }

      console.log(`플러그인 로드됨: ${plugin.id} (${plugin.metadata.name})`);
      return plugin;
    } catch (error) {
      console.error(`플러그인 로드 실패: ${pluginPath}`, error);
      throw error;
    }
  }

  /**
   * 플러그인 검증
   * 
   * @param plugin 검증할 객체
   * @returns 유효한 플러그인인지 여부
   */
  public validatePlugin(plugin: any): plugin is IPlugin {
    // 필수 속성 확인
    if (!plugin || typeof plugin !== 'object') {
      console.error('플러그인이 객체가 아닙니다');
      return false;
    }

    // ID 확인 (선택사항, 없으면 나중에 생성)
    if (plugin.id && typeof plugin.id !== 'string') {
      console.error('플러그인 ID가 문자열이 아닙니다');
      return false;
    }

    // 메타데이터 확인
    if (!this.validateMetadata(plugin.metadata)) {
      console.error('플러그인 메타데이터가 유효하지 않습니다');
      return false;
    }

    // 선택적 속성들의 타입 확인
    if (plugin.hooks && !Array.isArray(plugin.hooks)) {
      console.error('플러그인 hooks가 배열이 아닙니다');
      return false;
    }

    if (plugin.routes && !Array.isArray(plugin.routes)) {
      console.error('플러그인 routes가 배열이 아닙니다');
      return false;
    }

    if (plugin.menuItems && !Array.isArray(plugin.menuItems)) {
      console.error('플러그인 menuItems가 배열이 아닙니다');
      return false;
    }

    if (plugin.widgets && !Array.isArray(plugin.widgets)) {
      console.error('플러그인 widgets가 배열이 아닙니다');
      return false;
    }

    // 생명주기 메서드 타입 확인
    const lifecycleMethods = [
      'onActivate',
      'onDeactivate',
      'onInstall',
      'onUninstall',
      'onUpdate',
      'init',
      'cleanup'
    ];

    for (const method of lifecycleMethods) {
      if (plugin[method] && typeof plugin[method] !== 'function') {
        console.error(`플러그인 ${method}가 함수가 아닙니다`);
        return false;
      }
    }

    return true;
  }

  /**
   * 플러그인 메타데이터 검증
   * 
   * @param metadata 검증할 메타데이터
   * @returns 유효한 메타데이터인지 여부
   */
  private validateMetadata(metadata: any): metadata is IPluginMetadata {
    if (!metadata || typeof metadata !== 'object') {
      return false;
    }

    // 필수 속성 확인
    const requiredFields = ['name', 'version', 'description', 'author'];
    for (const field of requiredFields) {
      if (!metadata[field] || typeof metadata[field] !== 'string') {
        console.error(`메타데이터 ${field}이(가) 없거나 유효하지 않습니다`);
        return false;
      }
    }

    // 버전 형식 확인 (간단한 검증)
    if (!/^\d+\.\d+\.\d+/.test(metadata.version)) {
      console.error(`유효하지 않은 버전 형식: ${metadata.version}`);
      return false;
    }

    return true;
  }

  /**
   * 플러그인 의존성 확인
   * 
   * @param plugin 확인할 플러그인
   * @returns 모든 의존성이 충족되는지 여부
   */
  public async checkDependencies(plugin: IPlugin): Promise<boolean> {
    if (!plugin.metadata.dependencies || plugin.metadata.dependencies.length === 0) {
      return true;
    }

    const missingDependencies: string[] = [];

    for (const dependency of plugin.metadata.dependencies) {
      // 의존성 플러그인이 로드되어 있는지 확인
      if (!this.loadedPlugins.has(dependency)) {
        missingDependencies.push(dependency);
      }
    }

    if (missingDependencies.length > 0) {
      console.error(
        `플러그인 ${plugin.id}의 의존성이 누락되었습니다: ${missingDependencies.join(', ')}`
      );
      return false;
    }

    // CMS 버전 확인 (실제 구현 시 CMS 버전 가져오기)
    if (plugin.metadata.minCmsVersion) {
      const cmsVersion = process.env.CMS_VERSION || '1.0.0';
      if (!this.isVersionCompatible(cmsVersion, plugin.metadata.minCmsVersion)) {
        console.error(
          `플러그인 ${plugin.id}는 CMS 버전 ${plugin.metadata.minCmsVersion} 이상이 필요합니다`
        );
        return false;
      }
    }

    return true;
  }

  /**
   * 버전 호환성 확인
   * 
   * @param current 현재 버전
   * @param required 필요한 최소 버전
   * @returns 호환 가능 여부
   */
  private isVersionCompatible(current: string, required: string): boolean {
    const currentParts = current.split('.').map(Number);
    const requiredParts = required.split('.').map(Number);

    for (let i = 0; i < Math.max(currentParts.length, requiredParts.length); i++) {
      const currentPart = currentParts[i] || 0;
      const requiredPart = requiredParts[i] || 0;

      if (currentPart > requiredPart) {
        return true;
      }
      if (currentPart < requiredPart) {
        return false;
      }
    }

    return true;
  }

  /**
   * 로드된 플러그인 목록 가져오기
   */
  public getLoadedPlugins(): IPlugin[] {
    return Array.from(this.loadedPlugins.values());
  }

  /**
   * 특정 플러그인 가져오기
   */
  public getPlugin(pluginId: string): IPlugin | undefined {
    return this.loadedPlugins.get(pluginId);
  }

  /**
   * 플러그인 언로드
   */
  public unloadPlugin(pluginId: string): boolean {
    return this.loadedPlugins.delete(pluginId);
  }

  /**
   * 모든 플러그인 언로드
   */
  public unloadAll(): void {
    this.loadedPlugins.clear();
    console.log('모든 플러그인이 언로드되었습니다');
  }
}

// 기본 내보내기
export default PluginLoader;