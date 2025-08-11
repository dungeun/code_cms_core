/**
 * Socket.IO 클라이언트 라이브러리
 * 서버와 실시간 통신을 위한 클라이언트 구현
 */

import { io, Socket } from 'socket.io-client';

interface SocketConfig {
  url?: string;
  auth?: {
    token: string;
  };
  reconnection?: boolean;
  reconnectionDelay?: number;
  reconnectionAttempts?: number;
  transports?: ('websocket' | 'polling')[];
}

interface ChatMessage {
  id: string;
  userId: string;
  username?: string;
  roomId: string;
  message: string;
  timestamp: Date;
}

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
  timestamp: Date;
  read?: boolean;
}

interface UserStatus {
  userId: string;
  status: 'online' | 'offline';
  timestamp: Date;
}

/**
 * Socket.IO 클라이언트 매니저
 */
export class SocketClient {
  private socket: Socket | null = null;
  private chatSocket: Socket | null = null;
  private notificationSocket: Socket | null = null;
  private adminSocket: Socket | null = null;
  
  private listeners = new Map<string, Set<Function>>();
  private connectionStatus: 'connecting' | 'connected' | 'disconnected' = 'disconnected';
  private reconnectAttempts = 0;
  
  constructor(private config: SocketConfig = {}) {
    this.config = {
      url: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      transports: ['websocket', 'polling'],
      ...config,
    };
  }
  
  /**
   * 기본 소켓 연결
   */
  connect(token: string): void {
    if (this.socket?.connected) {
      console.log('이미 연결되어 있습니다.');
      return;
    }
    
    this.connectionStatus = 'connecting';
    
    this.socket = io(this.config.url!, {
      auth: { token },
      reconnection: this.config.reconnection,
      reconnectionDelay: this.config.reconnectionDelay,
      reconnectionAttempts: this.config.reconnectionAttempts,
      transports: this.config.transports,
    });
    
    this.setupEventHandlers();
  }
  
  /**
   * 채팅 네임스페이스 연결
   */
  connectChat(token: string): void {
    if (this.chatSocket?.connected) return;
    
    this.chatSocket = io(`${this.config.url}/chat`, {
      auth: { token },
      reconnection: this.config.reconnection,
    });
    
    this.setupChatHandlers();
  }
  
  /**
   * 알림 네임스페이스 연결
   */
  connectNotification(token: string): void {
    if (this.notificationSocket?.connected) return;
    
    this.notificationSocket = io(`${this.config.url}/notification`, {
      auth: { token },
      reconnection: this.config.reconnection,
    });
    
    this.setupNotificationHandlers();
  }
  
  /**
   * 관리자 네임스페이스 연결
   */
  connectAdmin(token: string): void {
    if (this.adminSocket?.connected) return;
    
    this.adminSocket = io(`${this.config.url}/admin`, {
      auth: { token },
      reconnection: this.config.reconnection,
    });
    
    this.setupAdminHandlers();
  }
  
  /**
   * 기본 이벤트 핸들러 설정
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;
    
    // 연결 성공
    this.socket.on('connect', () => {
      console.log('✅ Socket.IO 연결됨');
      this.connectionStatus = 'connected';
      this.reconnectAttempts = 0;
      this.emit('connection-status', { status: 'connected' });
    });
    
    // 연결 끊김
    this.socket.on('disconnect', (reason) => {
      console.log(`❌ Socket.IO 연결 끊김: ${reason}`);
      this.connectionStatus = 'disconnected';
      this.emit('connection-status', { status: 'disconnected', reason });
    });
    
    // 재연결 시도
    this.socket.on('reconnect_attempt', (attemptNumber) => {
      this.reconnectAttempts = attemptNumber;
      console.log(`🔄 재연결 시도 중... (${attemptNumber}/${this.config.reconnectionAttempts})`);
      this.emit('reconnecting', { attempt: attemptNumber });
    });
    
    // 재연결 성공
    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`✅ 재연결 성공 (시도: ${attemptNumber})`);
      this.emit('reconnected', { attempts: attemptNumber });
    });
    
    // 재연결 실패
    this.socket.on('reconnect_failed', () => {
      console.error('❌ 재연결 실패');
      this.emit('reconnect-failed', {});
    });
    
    // 에러
    this.socket.on('error', (error) => {
      console.error('Socket 에러:', error);
      this.emit('error', { error });
    });
    
    // 사용자 상태 변경
    this.socket.on('user-status', (data: UserStatus) => {
      this.emit('user-status', data);
    });
    
    // 시스템 메시지
    this.socket.on('system-message', (data) => {
      this.emit('system-message', data);
    });
    
    // 서버 종료 알림
    this.socket.on('server-shutdown', (data) => {
      console.warn('⚠️ 서버 종료 알림:', data.message);
      this.emit('server-shutdown', data);
    });
    
    // 강제 종료
    this.socket.on('kicked', (data) => {
      console.warn('⚠️ 강제 종료됨:', data.message);
      this.emit('kicked', data);
      this.disconnect();
    });
  }
  
  /**
   * 채팅 이벤트 핸들러 설정
   */
  private setupChatHandlers(): void {
    if (!this.chatSocket) return;
    
    // 새 메시지
    this.chatSocket.on('new-message', (message: ChatMessage) => {
      this.emit('chat:message', message);
    });
    
    // 사용자 입장
    this.chatSocket.on('user-joined', (data) => {
      this.emit('chat:user-joined', data);
    });
    
    // 사용자 퇴장
    this.chatSocket.on('user-left', (data) => {
      this.emit('chat:user-left', data);
    });
    
    // 타이핑 중
    this.chatSocket.on('user-typing', (data) => {
      this.emit('chat:typing', data);
    });
    
    // 타이핑 중지
    this.chatSocket.on('user-stop-typing', (data) => {
      this.emit('chat:stop-typing', data);
    });
    
    // 에러
    this.chatSocket.on('error', (error) => {
      this.emit('chat:error', error);
    });
  }
  
  /**
   * 알림 이벤트 핸들러 설정
   */
  private setupNotificationHandlers(): void {
    if (!this.notificationSocket) return;
    
    // 새 알림
    this.notificationSocket.on('new-notification', (notification: Notification) => {
      this.emit('notification:new', notification);
    });
    
    // 알림 업데이트
    this.notificationSocket.on('notification-updated', (notification: Notification) => {
      this.emit('notification:updated', notification);
    });
    
    // 알림 삭제
    this.notificationSocket.on('notification-deleted', (notificationId: string) => {
      this.emit('notification:deleted', { id: notificationId });
    });
  }
  
  /**
   * 관리자 이벤트 핸들러 설정
   */
  private setupAdminHandlers(): void {
    if (!this.adminSocket) return;
    
    // 메트릭 업데이트
    this.adminSocket.on('metrics-update', (metrics) => {
      this.emit('admin:metrics', metrics);
    });
    
    // 시스템 알림
    this.adminSocket.on('system-alert', (alert) => {
      this.emit('admin:alert', alert);
    });
  }
  
  /**
   * 채팅방 참가
   */
  joinChatRoom(roomId: string): void {
    if (!this.chatSocket) {
      console.error('채팅 소켓이 연결되지 않았습니다.');
      return;
    }
    
    this.chatSocket.emit('join-room', roomId);
  }
  
  /**
   * 채팅방 나가기
   */
  leaveChatRoom(roomId: string): void {
    if (!this.chatSocket) return;
    
    this.chatSocket.emit('leave-room', roomId);
  }
  
  /**
   * 메시지 전송
   */
  sendMessage(roomId: string, message: string): void {
    if (!this.chatSocket) {
      console.error('채팅 소켓이 연결되지 않았습니다.');
      return;
    }
    
    this.chatSocket.emit('send-message', { roomId, message });
  }
  
  /**
   * 타이핑 시작
   */
  startTyping(roomId: string): void {
    if (!this.chatSocket) return;
    
    this.chatSocket.emit('typing', roomId);
  }
  
  /**
   * 타이핑 중지
   */
  stopTyping(roomId: string): void {
    if (!this.chatSocket) return;
    
    this.chatSocket.emit('stop-typing', roomId);
  }
  
  /**
   * 알림 구독
   */
  subscribeNotifications(): void {
    if (!this.notificationSocket) {
      console.error('알림 소켓이 연결되지 않았습니다.');
      return;
    }
    
    this.notificationSocket.emit('subscribe');
  }
  
  /**
   * 알림 읽음 처리
   */
  markNotificationRead(notificationId: string): void {
    if (!this.notificationSocket) return;
    
    this.notificationSocket.emit('mark-read', notificationId);
  }
  
  /**
   * 모든 알림 읽음 처리
   */
  markAllNotificationsRead(): void {
    if (!this.notificationSocket) return;
    
    this.notificationSocket.emit('mark-all-read');
  }
  
  /**
   * 메트릭 구독 (관리자)
   */
  subscribeMetrics(): void {
    if (!this.adminSocket) {
      console.error('관리자 소켓이 연결되지 않았습니다.');
      return;
    }
    
    this.adminSocket.emit('subscribe-metrics');
  }
  
  /**
   * 시스템 메시지 전송 (관리자)
   */
  broadcastSystem(message: string): void {
    if (!this.adminSocket) {
      console.error('관리자 소켓이 연결되지 않았습니다.');
      return;
    }
    
    this.adminSocket.emit('broadcast-system', message);
  }
  
  /**
   * 사용자 강제 종료 (관리자)
   */
  kickUser(userId: string): void {
    if (!this.adminSocket) {
      console.error('관리자 소켓이 연결되지 않았습니다.');
      return;
    }
    
    this.adminSocket.emit('kick-user', userId);
  }
  
  /**
   * 이벤트 리스너 등록
   */
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }
  
  /**
   * 이벤트 리스너 제거
   */
  off(event: string, callback: Function): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }
  
  /**
   * 이벤트 발생
   */
  private emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }
  
  /**
   * 연결 상태 확인
   */
  isConnected(): boolean {
    return this.connectionStatus === 'connected';
  }
  
  /**
   * 연결 끊기
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    if (this.chatSocket) {
      this.chatSocket.disconnect();
      this.chatSocket = null;
    }
    
    if (this.notificationSocket) {
      this.notificationSocket.disconnect();
      this.notificationSocket = null;
    }
    
    if (this.adminSocket) {
      this.adminSocket.disconnect();
      this.adminSocket = null;
    }
    
    this.connectionStatus = 'disconnected';
    this.emit('disconnected', {});
  }
  
  /**
   * 재연결
   */
  reconnect(): void {
    if (this.socket && !this.socket.connected) {
      this.socket.connect();
    }
  }
}

// 전역 인스턴스
let globalSocketClient: SocketClient | null = null;

/**
 * Socket 클라이언트 가져오기
 */
export function getSocketClient(): SocketClient {
  if (!globalSocketClient) {
    globalSocketClient = new SocketClient();
  }
  return globalSocketClient;
}

/**
 * React Hook: Socket.IO 연결 관리
 */
export function useSocket() {
  const client = getSocketClient();
  
  return {
    connect: (token: string) => client.connect(token),
    disconnect: () => client.disconnect(),
    reconnect: () => client.reconnect(),
    isConnected: () => client.isConnected(),
    
    // 채팅
    connectChat: (token: string) => client.connectChat(token),
    joinRoom: (roomId: string) => client.joinChatRoom(roomId),
    leaveRoom: (roomId: string) => client.leaveChatRoom(roomId),
    sendMessage: (roomId: string, message: string) => client.sendMessage(roomId, message),
    startTyping: (roomId: string) => client.startTyping(roomId),
    stopTyping: (roomId: string) => client.stopTyping(roomId),
    
    // 알림
    connectNotification: (token: string) => client.connectNotification(token),
    subscribeNotifications: () => client.subscribeNotifications(),
    markNotificationRead: (id: string) => client.markNotificationRead(id),
    markAllNotificationsRead: () => client.markAllNotificationsRead(),
    
    // 관리자
    connectAdmin: (token: string) => client.connectAdmin(token),
    subscribeMetrics: () => client.subscribeMetrics(),
    broadcastSystem: (message: string) => client.broadcastSystem(message),
    kickUser: (userId: string) => client.kickUser(userId),
    
    // 이벤트
    on: (event: string, callback: Function) => client.on(event, callback),
    off: (event: string, callback: Function) => client.off(event, callback),
  };
}