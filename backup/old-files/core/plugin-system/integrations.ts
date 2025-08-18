/**
 * 플러그인 시스템 통합 모듈
 * 라우트, 메뉴, 위젯 시스템과의 연동 구현
 */

import type { IPlugin } from './plugin.types';
import type { RouteConfig } from '@remix-run/dev/routes';

// 라우트 시스템 통합
export interface PluginRoute {
  path: string;
  component: string;
  loader?: string;
  action?: string;
  meta?: Record<string, any>;
  permissions?: string[];
}

// 메뉴 시스템 통합
export interface PluginMenuItem {
  id: string;
  label: string;
  url: string;
  icon?: string;
  order: number;
  permissions?: string[];
  children?: PluginMenuItem[];
}

// 위젯 시스템 통합
export interface PluginWidget {
  id: string;
  name: string;
  description?: string;
  component: string;
  position: 'sidebar' | 'header' | 'footer' | 'content';
  order: number;
  settings?: Record<string, any>;
  permissions?: string[];
}

// 플러그인 라우트 관리자
export class PluginRouteManager {
  private routes = new Map<string, PluginRoute[]>();

  /**
   * 플러그인의 라우트 등록
   */
  registerRoutes(pluginId: string, routes: PluginRoute[]): void {
    // 라우트 유효성 검증
    for (const route of routes) {
      if (!route.path || !route.component) {
        throw new Error(`플러그인 ${pluginId}: 라우트에 path와 component는 필수입니다.`);
      }
      
      // 경로 중복 검사
      if (this.hasConflictingRoute(route.path)) {
        throw new Error(`플러그인 ${pluginId}: 라우트 경로 '${route.path}'가 이미 존재합니다.`);
      }
    }

    this.routes.set(pluginId, routes);
    console.log(`플러그인 ${pluginId}: ${routes.length}개 라우트 등록됨`);
  }

  /**
   * 플러그인의 라우트 제거
   */
  unregisterRoutes(pluginId: string): void {
    const routes = this.routes.get(pluginId);
    if (routes) {
      this.routes.delete(pluginId);
      console.log(`플러그인 ${pluginId}: 라우트 제거됨`);
    }
  }

  /**
   * 모든 플러그인 라우트 조회
   */
  getAllRoutes(): Record<string, PluginRoute[]> {
    return Object.fromEntries(this.routes);
  }

  /**
   * 특정 플러그인의 라우트 조회
   */
  getRoutesForPlugin(pluginId: string): PluginRoute[] {
    return this.routes.get(pluginId) || [];
  }

  /**
   * 라우트 충돌 검사
   */
  private hasConflictingRoute(path: string): boolean {
    for (const routes of this.routes.values()) {
      if (routes.some(route => route.path === path)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Remix 라우트 설정 생성
   */
  generateRemixRoutes(): RouteConfig {
    const routeConfig: RouteConfig = {};
    
    for (const [pluginId, routes] of this.routes) {
      for (const route of routes) {
        const routeId = `plugin-${pluginId}-${route.path.replace(/[^a-zA-Z0-9]/g, '-')}`;
        
        routeConfig[routeId] = {
          file: `plugins/${pluginId}/routes/${route.component}.tsx`,
          path: route.path,
        };
      }
    }
    
    return routeConfig;
  }
}

// 플러그인 메뉴 관리자
export class PluginMenuManager {
  private menus = new Map<string, PluginMenuItem[]>();

  /**
   * 플러그인의 메뉴 등록
   */
  registerMenuItems(pluginId: string, menuItems: PluginMenuItem[]): void {
    // 메뉴 아이템 유효성 검증
    for (const item of menuItems) {
      if (!item.id || !item.label || !item.url) {
        throw new Error(`플러그인 ${pluginId}: 메뉴 아이템에 id, label, url은 필수입니다.`);
      }
      
      // ID 중복 검사
      if (this.hasConflictingMenuItem(item.id)) {
        throw new Error(`플러그인 ${pluginId}: 메뉴 아이템 ID '${item.id}'가 이미 존재합니다.`);
      }
    }

    this.menus.set(pluginId, menuItems);
    console.log(`플러그인 ${pluginId}: ${menuItems.length}개 메뉴 아이템 등록됨`);
  }

  /**
   * 플러그인의 메뉴 제거
   */
  unregisterMenuItems(pluginId: string): void {
    const menuItems = this.menus.get(pluginId);
    if (menuItems) {
      this.menus.delete(pluginId);
      console.log(`플러그인 ${pluginId}: 메뉴 아이템 제거됨`);
    }
  }

  /**
   * 사용자 권한에 따른 메뉴 조회
   */
  getMenuItemsForUser(userPermissions: string[] = []): PluginMenuItem[] {
    const allItems: PluginMenuItem[] = [];
    
    for (const menuItems of this.menus.values()) {
      for (const item of menuItems) {
        if (this.hasPermission(item.permissions, userPermissions)) {
          allItems.push(item);
        }
      }
    }
    
    // 순서대로 정렬
    return allItems.sort((a, b) => a.order - b.order);
  }

  /**
   * 메뉴 아이템 ID 중복 검사
   */
  private hasConflictingMenuItem(id: string): boolean {
    for (const menuItems of this.menus.values()) {
      if (menuItems.some(item => item.id === id)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 권한 검사
   */
  private hasPermission(requiredPermissions?: string[], userPermissions: string[] = []): boolean {
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }
    return requiredPermissions.some(permission => userPermissions.includes(permission));
  }
}

// 플러그인 위젯 관리자
export class PluginWidgetManager {
  private widgets = new Map<string, PluginWidget[]>();

  /**
   * 플러그인의 위젯 등록
   */
  registerWidgets(pluginId: string, widgets: PluginWidget[]): void {
    // 위젯 유효성 검증
    for (const widget of widgets) {
      if (!widget.id || !widget.name || !widget.component) {
        throw new Error(`플러그인 ${pluginId}: 위젯에 id, name, component는 필수입니다.`);
      }
      
      // ID 중복 검사
      if (this.hasConflictingWidget(widget.id)) {
        throw new Error(`플러그인 ${pluginId}: 위젯 ID '${widget.id}'가 이미 존재합니다.`);
      }
    }

    this.widgets.set(pluginId, widgets);
    console.log(`플러그인 ${pluginId}: ${widgets.length}개 위젯 등록됨`);
  }

  /**
   * 플러그인의 위젯 제거
   */
  unregisterWidgets(pluginId: string): void {
    const widgets = this.widgets.get(pluginId);
    if (widgets) {
      this.widgets.delete(pluginId);
      console.log(`플러그인 ${pluginId}: 위젯 제거됨`);
    }
  }

  /**
   * 특정 위치의 위젯 조회
   */
  getWidgetsForPosition(
    position: PluginWidget['position'], 
    userPermissions: string[] = []
  ): PluginWidget[] {
    const positionWidgets: PluginWidget[] = [];
    
    for (const widgets of this.widgets.values()) {
      for (const widget of widgets) {
        if (widget.position === position && this.hasPermission(widget.permissions, userPermissions)) {
          positionWidgets.push(widget);
        }
      }
    }
    
    // 순서대로 정렬
    return positionWidgets.sort((a, b) => a.order - b.order);
  }

  /**
   * 모든 위젯 조회 (관리자용)
   */
  getAllWidgets(): Record<string, PluginWidget[]> {
    return Object.fromEntries(this.widgets);
  }

  /**
   * 위젯 ID 중복 검사
   */
  private hasConflictingWidget(id: string): boolean {
    for (const widgets of this.widgets.values()) {
      if (widgets.some(widget => widget.id === id)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 권한 검사
   */
  private hasPermission(requiredPermissions?: string[], userPermissions: string[] = []): boolean {
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }
    return requiredPermissions.some(permission => userPermissions.includes(permission));
  }
}

// 통합 관리자 (싱글톤)
export class PluginIntegrationManager {
  private static instance: PluginIntegrationManager;
  
  private routeManager = new PluginRouteManager();
  private menuManager = new PluginMenuManager();
  private widgetManager = new PluginWidgetManager();

  private constructor() {}

  static getInstance(): PluginIntegrationManager {
    if (!this.instance) {
      this.instance = new PluginIntegrationManager();
    }
    return this.instance;
  }

  /**
   * 플러그인 통합 요소 등록
   */
  registerPlugin(plugin: IPlugin, integrations: {
    routes?: PluginRoute[];
    menuItems?: PluginMenuItem[];
    widgets?: PluginWidget[];
  }): void {
    const { routes, menuItems, widgets } = integrations;

    if (routes && routes.length > 0) {
      this.routeManager.registerRoutes(plugin.metadata.id, routes);
    }

    if (menuItems && menuItems.length > 0) {
      this.menuManager.registerMenuItems(plugin.metadata.id, menuItems);
    }

    if (widgets && widgets.length > 0) {
      this.widgetManager.registerWidgets(plugin.metadata.id, widgets);
    }
  }

  /**
   * 플러그인 통합 요소 제거
   */
  unregisterPlugin(pluginId: string): void {
    this.routeManager.unregisterRoutes(pluginId);
    this.menuManager.unregisterMenuItems(pluginId);
    this.widgetManager.unregisterWidgets(pluginId);
  }

  // 각 관리자에 대한 접근자
  get routes() {
    return this.routeManager;
  }

  get menus() {
    return this.menuManager;
  }

  get widgets() {
    return this.widgetManager;
  }
}