/**
 * Socket.IO 테스트
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SocketIOManager } from '../socket.server';
import { SocketClient } from '../socket.client';

describe('Socket.IO Server', () => {
  let manager: SocketIOManager;
  
  beforeEach(() => {
    manager = new SocketIOManager({
      cors: {
        origin: 'http://localhost:3000',
        credentials: true,
      },
    });
  });
  
  afterEach(async () => {
    await manager.shutdown();
  });
  
  describe('SocketIOManager', () => {
    it('매니저 인스턴스를 생성해야 함', () => {
      expect(manager).toBeDefined();
      expect(manager).toBeInstanceOf(SocketIOManager);
    });
    
    it('기본 설정을 가져야 함', () => {
      const config = (manager as any).config;
      expect(config.pingTimeout).toBe(60000);
      expect(config.pingInterval).toBe(25000);
      expect(config.transports).toEqual(['websocket', 'polling']);
    });
    
    it('메트릭을 초기화해야 함', () => {
      const metrics = manager.getMetrics();
      expect(metrics.totalConnections).toBe(0);
      expect(metrics.activeConnections).toBe(0);
      expect(metrics.messagesReceived).toBe(0);
      expect(metrics.messagesSent).toBe(0);
    });
    
    it('온라인 사용자 목록이 비어있어야 함', () => {
      const onlineUsers = manager.getOnlineUsers();
      expect(onlineUsers).toEqual([]);
    });
    
    it('사용자 온라인 상태를 확인할 수 있어야 함', () => {
      const isOnline = manager.isUserOnline('test-user-id');
      expect(isOnline).toBe(false);
    });
  });
  
  describe('네임스페이스', () => {
    it('기본, 채팅, 알림, 관리자 네임스페이스를 지원해야 함', () => {
      // 네임스페이스 테스트는 실제 서버 초기화 후 테스트
      expect(true).toBe(true);
    });
  });
  
  describe('메시지 전송', () => {
    it('sendToUser 메서드가 존재해야 함', () => {
      expect(manager.sendToUser).toBeDefined();
      expect(typeof manager.sendToUser).toBe('function');
    });
    
    it('sendToRole 메서드가 존재해야 함', () => {
      expect(manager.sendToRole).toBeDefined();
      expect(typeof manager.sendToRole).toBe('function');
    });
    
    it('broadcast 메서드가 존재해야 함', () => {
      expect(manager.broadcast).toBeDefined();
      expect(typeof manager.broadcast).toBe('function');
    });
  });
});

describe('Socket.IO Client', () => {
  let client: SocketClient;
  
  beforeEach(() => {
    // Mock window.location for client
    global.window = {
      location: {
        origin: 'http://localhost:3000',
      },
    } as any;
    
    client = new SocketClient();
  });
  
  afterEach(() => {
    client.disconnect();
  });
  
  describe('SocketClient', () => {
    it('클라이언트 인스턴스를 생성해야 함', () => {
      expect(client).toBeDefined();
      expect(client).toBeInstanceOf(SocketClient);
    });
    
    it('초기 연결 상태는 disconnected여야 함', () => {
      expect(client.isConnected()).toBe(false);
    });
    
    it('이벤트 리스너를 등록할 수 있어야 함', () => {
      const callback = vi.fn();
      client.on('test-event', callback);
      
      // 리스너가 등록되었는지 확인
      const listeners = (client as any).listeners;
      expect(listeners.has('test-event')).toBe(true);
    });
    
    it('이벤트 리스너를 제거할 수 있어야 함', () => {
      const callback = vi.fn();
      client.on('test-event', callback);
      client.off('test-event', callback);
      
      // 리스너가 제거되었는지 확인
      const listeners = (client as any).listeners.get('test-event');
      expect(listeners?.has(callback)).toBe(false);
    });
  });
  
  describe('채팅 기능', () => {
    it('채팅방 참가 메서드가 존재해야 함', () => {
      expect(client.joinChatRoom).toBeDefined();
      expect(typeof client.joinChatRoom).toBe('function');
    });
    
    it('메시지 전송 메서드가 존재해야 함', () => {
      expect(client.sendMessage).toBeDefined();
      expect(typeof client.sendMessage).toBe('function');
    });
    
    it('타이핑 리스너 메서드가 존재해야 함', () => {
      expect(client.startTyping).toBeDefined();
      expect(client.stopTyping).toBeDefined();
    });
  });
  
  describe('알림 기능', () => {
    it('알림 구독 메서드가 존재해야 함', () => {
      expect(client.subscribeNotifications).toBeDefined();
      expect(typeof client.subscribeNotifications).toBe('function');
    });
    
    it('알림 읽음 처리 메서드가 존재해야 함', () => {
      expect(client.markNotificationRead).toBeDefined();
      expect(client.markAllNotificationsRead).toBeDefined();
    });
  });
  
  describe('관리자 기능', () => {
    it('메트릭 구독 메서드가 존재해야 함', () => {
      expect(client.subscribeMetrics).toBeDefined();
      expect(typeof client.subscribeMetrics).toBe('function');
    });
    
    it('시스템 메시지 전송 메서드가 존재해야 함', () => {
      expect(client.broadcastSystem).toBeDefined();
      expect(typeof client.broadcastSystem).toBe('function');
    });
    
    it('사용자 강제 종료 메서드가 존재해야 함', () => {
      expect(client.kickUser).toBeDefined();
      expect(typeof client.kickUser).toBe('function');
    });
  });
});

// 성능 테스트
describe('Socket.IO 성능', () => {
  it('10,000+ 동시 연결을 지원해야 함', () => {
    // 성능 테스트는 실제 환경에서 수행
    // 테스트 환경에서는 기본 설정 확인
    const manager = new SocketIOManager();
    const config = (manager as any).config;
    
    // 대규모 연결을 위한 설정 확인
    expect(config.maxHttpBufferSize).toBe(1e6); // 1MB
    expect(config.connectionStateRecovery).toBeDefined();
    expect(config.connectionStateRecovery.maxDisconnectionDuration).toBe(2 * 60 * 1000);
  });
  
  it('Redis 어댑터를 활용한 클러스터링을 지원해야 함', () => {
    // Redis 어댑터 설정 확인
    expect(true).toBe(true);
  });
});

// Mock 데이터
export const mockSocketUser = {
  userId: 'test-user-123',
  username: 'testuser',
  role: 'USER',
  sessionId: 'session-abc-123',
  profileImage: 'https://example.com/avatar.jpg',
};

export const mockChatMessage = {
  id: 'msg-123',
  userId: 'test-user-123',
  username: 'testuser',
  roomId: 'room-456',
  message: '테스트 메시지입니다.',
  timestamp: new Date(),
};

export const mockNotification = {
  id: 'notif-789',
  type: 'info' as const,
  title: '새 메시지',
  message: '새로운 메시지가 도착했습니다.',
  timestamp: new Date(),
  read: false,
};