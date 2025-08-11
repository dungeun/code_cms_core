/**
 * L1 메모리 캐시 - LRU (Least Recently Used) 구현
 * 고속 메모리 캐싱 레이어 (100MB 제한)
 */

export interface LRUCacheOptions {
  maxSize?: number; // 최대 메모리 크기 (bytes)
  maxItems?: number; // 최대 아이템 수
  ttl?: number; // 기본 TTL (초)
  onEvict?: (key: string, value: any) => void; // 제거 시 콜백
}

interface CacheNode<T> {
  key: string;
  value: T;
  size: number;
  expiry?: number;
  prev?: CacheNode<T>;
  next?: CacheNode<T>;
  hits: number; // 히트 카운트
  lastAccess: number;
}

/**
 * LRU 캐시 구현
 * 이중 연결 리스트와 해시맵을 사용한 O(1) 접근
 */
export class LRUCache<T = any> {
  private cache = new Map<string, CacheNode<T>>();
  private head?: CacheNode<T>;
  private tail?: CacheNode<T>;
  
  private currentSize: number = 0;
  private maxSize: number;
  private maxItems: number;
  private defaultTTL?: number;
  private onEvict?: (key: string, value: any) => void;
  
  // 통계
  private hits: number = 0;
  private misses: number = 0;
  private evictions: number = 0;
  
  constructor(options: LRUCacheOptions = {}) {
    this.maxSize = options.maxSize || 100 * 1024 * 1024; // 100MB 기본값
    this.maxItems = options.maxItems || 10000;
    this.defaultTTL = options.ttl;
    this.onEvict = options.onEvict;
  }
  
  /**
   * 값 저장
   */
  set(key: string, value: T, ttl?: number): void {
    // 기존 노드 제거
    if (this.cache.has(key)) {
      this.remove(key);
    }
    
    // 크기 계산
    const size = this.calculateSize(value);
    
    // 메모리 공간 확보
    while (
      (this.currentSize + size > this.maxSize || this.cache.size >= this.maxItems) &&
      this.tail
    ) {
      this.evictLRU();
    }
    
    // 새 노드 생성
    const node: CacheNode<T> = {
      key,
      value,
      size,
      hits: 0,
      lastAccess: Date.now(),
    };
    
    // TTL 설정
    const effectiveTTL = ttl ?? this.defaultTTL;
    if (effectiveTTL) {
      node.expiry = Date.now() + effectiveTTL * 1000;
    }
    
    // 헤드에 추가
    this.addToHead(node);
    this.cache.set(key, node);
    this.currentSize += size;
  }
  
  /**
   * 값 조회
   */
  get(key: string): T | null {
    const node = this.cache.get(key);
    
    if (!node) {
      this.misses++;
      return null;
    }
    
    // 만료 확인
    if (node.expiry && Date.now() > node.expiry) {
      this.remove(key);
      this.misses++;
      return null;
    }
    
    // 히트 통계 업데이트
    this.hits++;
    node.hits++;
    node.lastAccess = Date.now();
    
    // 헤드로 이동 (최근 사용)
    this.moveToHead(node);
    
    return node.value;
  }
  
  /**
   * 키 존재 확인
   */
  has(key: string): boolean {
    const node = this.cache.get(key);
    
    if (!node) return false;
    
    // 만료 확인
    if (node.expiry && Date.now() > node.expiry) {
      this.remove(key);
      return false;
    }
    
    return true;
  }
  
  /**
   * 키 삭제
   */
  delete(key: string): boolean {
    return this.remove(key);
  }
  
  /**
   * 모든 키 삭제
   */
  clear(): void {
    this.cache.clear();
    this.head = undefined;
    this.tail = undefined;
    this.currentSize = 0;
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }
  
  /**
   * 캐시 통계
   */
  getStats(): {
    size: number;
    items: number;
    memoryUsage: number;
    maxMemory: number;
    hitRate: number;
    hits: number;
    misses: number;
    evictions: number;
  } {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? this.hits / total : 0;
    
    return {
      size: this.cache.size,
      items: this.cache.size,
      memoryUsage: this.currentSize,
      maxMemory: this.maxSize,
      hitRate,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
    };
  }
  
  /**
   * 가장 인기있는 키 조회
   */
  getHotKeys(limit: number = 10): Array<{ key: string; hits: number }> {
    const entries = Array.from(this.cache.entries())
      .map(([key, node]) => ({ key, hits: node.hits }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, limit);
    
    return entries;
  }
  
  /**
   * 만료된 키 정리
   */
  prune(): number {
    let pruned = 0;
    const now = Date.now();
    
    for (const [key, node] of this.cache.entries()) {
      if (node.expiry && now > node.expiry) {
        this.remove(key);
        pruned++;
      }
    }
    
    return pruned;
  }
  
  // 내부 메서드들
  
  private remove(key: string): boolean {
    const node = this.cache.get(key);
    if (!node) return false;
    
    // 리스트에서 제거
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }
    
    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
    
    // 캐시에서 제거
    this.cache.delete(key);
    this.currentSize -= node.size;
    
    // 콜백 호출
    if (this.onEvict) {
      this.onEvict(key, node.value);
    }
    
    return true;
  }
  
  private addToHead(node: CacheNode<T>): void {
    node.prev = undefined;
    node.next = this.head;
    
    if (this.head) {
      this.head.prev = node;
    }
    
    this.head = node;
    
    if (!this.tail) {
      this.tail = node;
    }
  }
  
  private moveToHead(node: CacheNode<T>): void {
    if (node === this.head) return;
    
    // 리스트에서 제거
    if (node.prev) {
      node.prev.next = node.next;
    }
    
    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
    
    // 헤드에 추가
    node.prev = undefined;
    node.next = this.head;
    
    if (this.head) {
      this.head.prev = node;
    }
    
    this.head = node;
  }
  
  private evictLRU(): void {
    if (!this.tail) return;
    
    const key = this.tail.key;
    this.remove(key);
    this.evictions++;
  }
  
  private calculateSize(value: any): number {
    // 간단한 크기 추정 (실제로는 더 정교한 계산 필요)
    if (typeof value === 'string') {
      return value.length * 2; // UTF-16
    } else if (typeof value === 'number') {
      return 8;
    } else if (typeof value === 'boolean') {
      return 4;
    } else if (value === null || value === undefined) {
      return 0;
    } else if (Buffer.isBuffer(value)) {
      return value.length;
    } else {
      // 객체는 JSON 문자열 크기로 추정
      try {
        return JSON.stringify(value).length * 2;
      } catch {
        return 1024; // 기본값 1KB
      }
    }
  }
  
  /**
   * 캐시 워밍업
   * 자주 사용되는 데이터를 미리 로드
   */
  async warmup(
    keys: string[],
    loader: (key: string) => Promise<T | null>
  ): Promise<{ loaded: number; failed: number }> {
    let loaded = 0;
    let failed = 0;
    
    for (const key of keys) {
      try {
        const value = await loader(key);
        if (value !== null) {
          this.set(key, value);
          loaded++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`Failed to warmup key ${key}:`, error);
        failed++;
      }
    }
    
    return { loaded, failed };
  }
  
  /**
   * 캐시 덤프 (디버깅용)
   */
  dump(): Array<{ key: string; size: number; hits: number; expiry?: number }> {
    return Array.from(this.cache.entries()).map(([key, node]) => ({
      key,
      size: node.size,
      hits: node.hits,
      expiry: node.expiry,
    }));
  }
}

// 전역 L1 캐시 인스턴스
let globalL1Cache: LRUCache | null = null;

/**
 * 전역 L1 캐시 인스턴스 가져오기
 */
export function getGlobalL1Cache(): LRUCache {
  if (!globalL1Cache) {
    globalL1Cache = new LRUCache({
      maxSize: 100 * 1024 * 1024, // 100MB
      maxItems: 10000,
      ttl: 300, // 5분 기본 TTL
    });
    
    // 주기적 정리 (1분마다)
    setInterval(() => {
      globalL1Cache?.prune();
    }, 60 * 1000);
  }
  
  return globalL1Cache;
}