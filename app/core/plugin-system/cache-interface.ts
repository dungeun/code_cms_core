/**
 * 플러그인 시스템용 캐시 인터페이스
 * 
 * 플러그인이 안전하게 캐시를 사용할 수 있도록 제한된 인터페이스 제공
 */

export interface CacheInterface {
  /**
   * 키-값 저장
   * 
   * @param key 캐시 키 (자동으로 플러그인 ID가 접두사로 추가됨)
   * @param value 저장할 값
   * @param ttl 만료 시간 (초 단위, 선택사항)
   */
  set(key: string, value: any, ttl?: number): Promise<void>;
  
  /**
   * 키로 값 조회
   * 
   * @param key 캐시 키
   * @returns 저장된 값 또는 null
   */
  get<T = any>(key: string): Promise<T | null>;
  
  /**
   * 키 삭제
   * 
   * @param key 캐시 키
   */
  del(key: string): Promise<void>;
  
  /**
   * 키 존재 확인
   * 
   * @param key 캐시 키
   * @returns 존재 여부
   */
  has(key: string): Promise<boolean>;
  
  /**
   * 만료 시간 설정
   * 
   * @param key 캐시 키
   * @param ttl 만료 시간 (초 단위)
   */
  expire(key: string, ttl: number): Promise<void>;
  
  /**
   * 플러그인 관련 모든 키 삭제
   */
  clear(): Promise<void>;
  
  /**
   * 패턴으로 키 조회
   * 
   * @param pattern 검색 패턴 (glob 스타일)
   * @returns 매칭되는 키 목록
   */
  keys(pattern: string): Promise<string[]>;
}

/**
 * 메모리 기반 캐시 구현
 */
class MemoryCache implements CacheInterface {
  private cache = new Map<string, { value: any; expiry?: number }>();
  private timers = new Map<string, NodeJS.Timeout>();

  async set(key: string, value: any, ttl?: number): Promise<void> {
    // 기존 타이머 정리
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key)!);
      this.timers.delete(key);
    }

    const expiry = ttl ? Date.now() + ttl * 1000 : undefined;
    this.cache.set(key, { value, expiry });

    // TTL이 설정된 경우 자동 삭제 타이머 설정
    if (ttl) {
      const timer = setTimeout(() => {
        this.cache.delete(key);
        this.timers.delete(key);
      }, ttl * 1000);
      
      this.timers.set(key, timer);
    }
  }

  async get<T = any>(key: string): Promise<T | null> {
    const item = this.cache.get(key);
    if (!item) return null;

    // 만료 확인
    if (item.expiry && Date.now() > item.expiry) {
      this.cache.delete(key);
      if (this.timers.has(key)) {
        clearTimeout(this.timers.get(key)!);
        this.timers.delete(key);
      }
      return null;
    }

    return item.value;
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key)!);
      this.timers.delete(key);
    }
  }

  async has(key: string): Promise<boolean> {
    const item = this.cache.get(key);
    if (!item) return false;

    // 만료 확인
    if (item.expiry && Date.now() > item.expiry) {
      await this.del(key);
      return false;
    }

    return true;
  }

  async expire(key: string, ttl: number): Promise<void> {
    const item = this.cache.get(key);
    if (!item) return;

    // 새로운 만료 시간 설정
    const expiry = Date.now() + ttl * 1000;
    this.cache.set(key, { ...item, expiry });

    // 기존 타이머 정리하고 새 타이머 설정
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key)!);
    }

    const timer = setTimeout(() => {
      this.cache.delete(key);
      this.timers.delete(key);
    }, ttl * 1000);
    
    this.timers.set(key, timer);
  }

  async clear(): Promise<void> {
    // 모든 타이머 정리
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    
    this.cache.clear();
    this.timers.clear();
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
    return Array.from(this.cache.keys()).filter(key => regex.test(key));
  }
}

/**
 * 플러그인용 캐시 클라이언트 생성
 * 
 * @param pluginId 플러그인 ID (키 접두사로 사용)
 * @returns 플러그인 전용 캐시 클라이언트
 */
export function createPluginCacheClient(pluginId: string): CacheInterface {
  // Redis가 사용 가능하면 Redis 기반 플러그인 캐시 생성
  if (process.env.REDIS_HOST_1 || process.env.REDIS_CLUSTER_ENABLED === 'true') {
    try {
      return createPluginRedisCacheClient(pluginId);
    } catch (error) {
      console.error(`플러그인 ${pluginId}의 Redis 캐시 생성 실패, 메모리 캐시로 대체:`, error);
    }
  }
  
  // Redis를 사용할 수 없으면 메모리 캐시로 대체
  const globalCache = getGlobalCache();
  const keyPrefix = `plugin:${pluginId}:`;

  return {
    async set(key: string, value: any, ttl?: number): Promise<void> {
      return globalCache.set(keyPrefix + key, value, ttl);
    },

    async get<T = any>(key: string): Promise<T | null> {
      return globalCache.get<T>(keyPrefix + key);
    },

    async del(key: string): Promise<void> {
      return globalCache.del(keyPrefix + key);
    },

    async has(key: string): Promise<boolean> {
      return globalCache.has(keyPrefix + key);
    },

    async expire(key: string, ttl: number): Promise<void> {
      return globalCache.expire(keyPrefix + key, ttl);
    },

    async clear(): Promise<void> {
      const keys = await globalCache.keys(keyPrefix + '*');
      for (const key of keys) {
        await globalCache.del(key);
      }
    },

    async keys(pattern: string): Promise<string[]> {
      const keys = await globalCache.keys(keyPrefix + pattern);
      return keys.map(key => key.replace(keyPrefix, ''));
    }
  };
}

import { RedisCache, createPluginRedisCacheClient } from '~/lib/redis/redis-cache';

// 전역 캐시 인스턴스 (Redis 또는 Memory)
let globalCacheInstance: CacheInterface | null = null;

/**
 * 전역 캐시 인스턴스 초기화
 * 환경 변수에 따라 Redis 또는 Memory 캐시 사용
 */
export function initializeCache(): void {
  if (!globalCacheInstance) {
    // Redis가 설정되어 있으면 Redis 사용, 아니면 메모리 캐시 사용
    if (process.env.REDIS_HOST_1 || process.env.REDIS_CLUSTER_ENABLED === 'true') {
      try {
        globalCacheInstance = new RedisCache('global');
        console.log('Redis 캐시 초기화 완료');
      } catch (error) {
        console.error('Redis 캐시 초기화 실패, 메모리 캐시로 대체:', error);
        globalCacheInstance = new MemoryCache();
      }
    } else {
      globalCacheInstance = new MemoryCache();
      console.log('메모리 캐시 초기화 완료');
    }
  }
}

/**
 * 전역 캐시 인스턴스 가져오기
 */
export function getGlobalCache(): CacheInterface {
  if (!globalCacheInstance) {
    initializeCache();
  }
  return globalCacheInstance!;
}