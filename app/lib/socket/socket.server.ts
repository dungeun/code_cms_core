/**
 * Socket.IO 서버 설정 및 관리
 * 10,000+ 동시 연결을 지원하는 실시간 통신 서버
 */

import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { getRedisCluster } from '../redis/cluster.server';
import { getSessionManager } from '../session.server';
import { db } from '~/utils/db.server';

/**
 * Socket.IO 서버 설정
 */
export interface SocketConfig {
  cors?: {
    origin: string | string[];
    credentials: boolean;
  };
  pingTimeout?: number;
  pingInterval?: number;
  transports?: ('websocket' | 'polling')[];
  maxHttpBufferSize?: number;
  connectionStateRecovery?: {
    maxDisconnectionDuration?: number;
    skipMiddlewares?: boolean;
  };
}

/**
 * Socket 사용자 정보
 */
export interface SocketUser {
  userId: string;
  username: string;
  role: string;
  sessionId: string;
  profileImage?: string;
}

/**
 * Socket.IO 서버 매니저
 */
export class SocketIOManager {
  private io: SocketIOServer | null = null;
  private connections = new Map<string, Socket>();
  private userSockets = new Map<string, Set<string>>(); // userId -> socketIds
  private socketUsers = new Map<string, SocketUser>(); // socketId -> user
  
  // 메트릭
  private metrics = {
    totalConnections: 0,
    activeConnections: 0,
    peakConnections: 0,
    messagesReceived: 0,
    messagesSent: 0,
    errors: 0,
    reconnections: 0,
  };
  
  constructor(private config: SocketConfig = {}) {
    this.config = {
      cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:3000',
        credentials: true,
      },
      pingTimeout: 60000, // 60초
      pingInterval: 25000, // 25초
      transports: ['websocket', 'polling'],
      maxHttpBufferSize: 1e6, // 1MB
      connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000, // 2분
        skipMiddlewares: false,
      },
      ...config,
    };
  }
  
  /**
   * Socket.IO 서버 초기화
   */
  async initialize(httpServer: HTTPServer): Promise<void> {
    console.log('🚀 Socket.IO 서버 초기화 중...');
    
    // Socket.IO 서버 생성
    this.io = new SocketIOServer(httpServer, {
      ...this.config,
      adapter: await this.createRedisAdapter(),
    });
    
    // 미들웨어 설정
    this.setupMiddleware();
    
    // 네임스페이스 설정
    this.setupNamespaces();
    
    // 기본 이벤트 핸들러
    this.setupEventHandlers();
    
    // 메트릭 수집 시작
    this.startMetricsCollection();
    
    console.log('✅ Socket.IO 서버 초기화 완료');
  }
  
  /**
   * Redis 어댑터 생성 (클러스터 지원)
   */
  private async createRedisAdapter() {
    const redisCluster = getRedisCluster();
    
    // Pub/Sub용 클라이언트 생성 (복제본 필요)
    const pubClient = redisCluster;
    const subClient = redisCluster.duplicate();
    
    // Redis 어댑터 생성
    const adapter = createAdapter(pubClient, subClient);
    
    console.log('📡 Redis 어댑터 연결됨 (클러스터 모드)');
    
    return adapter;
  }
  
  /**
   * 인증 미들웨어 설정
   */
  private setupMiddleware(): void {
    if (!this.io) return;
    
    this.io.use(async (socket, next) => {
      try {
        // 토큰 추출
        const token = socket.handshake.auth.token || 
                     socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('인증 토큰이 없습니다.'));
        }
        
        // 세션 검증
        const sessionManager = getSessionManager();
        const session = await sessionManager.getSession(token);
        
        if (!session || !session.userId) {
          return next(new Error('유효하지 않은 세션입니다.'));
        }
        
        // 사용자 정보 조회
        const user = await db.user.findUnique({
          where: { id: session.userId },
          select: {
            id: true,
            username: true,
            role: true,
            profileImage: true,
          },
        });
        
        if (!user) {
          return next(new Error('사용자를 찾을 수 없습니다.'));
        }
        
        // Socket에 사용자 정보 저장
        (socket as any).user = {
          userId: user.id,
          username: user.username,
          role: user.role,
          sessionId: token,
          profileImage: user.profileImage,
        } as SocketUser;
        
        next();
      } catch (error) {
        console.error('Socket 인증 실패:', error);
        next(new Error('인증 실패'));
      }
    });
  }
  
  /**
   * 네임스페이스 설정
   */
  private setupNamespaces(): void {
    if (!this.io) return;
    
    // 기본 네임스페이스
    const defaultNamespace = this.io.of('/');
    
    // 채팅 네임스페이스
    const chatNamespace = this.io.of('/chat');
    this.setupChatNamespace(chatNamespace);
    
    // 알림 네임스페이스
    const notificationNamespace = this.io.of('/notification');
    this.setupNotificationNamespace(notificationNamespace);
    
    // 관리자 네임스페이스
    const adminNamespace = this.io.of('/admin');
    this.setupAdminNamespace(adminNamespace);
  }
  
  /**
   * 기본 이벤트 핸들러
   */
  private setupEventHandlers(): void {
    if (!this.io) return;
    
    this.io.on('connection', (socket: Socket) => {
      const user = (socket as any).user as SocketUser;
      
      console.log(`👤 사용자 연결: ${user.username} (${socket.id})`);
      
      // 연결 관리
      this.handleConnection(socket, user);
      
      // 기본 이벤트
      socket.on('ping', () => socket.emit('pong'));
      
      socket.on('disconnect', (reason) => {
        this.handleDisconnection(socket, user, reason);
      });
      
      socket.on('error', (error) => {
        console.error(`Socket 에러 (${socket.id}):`, error);
        this.metrics.errors++;
      });
    });
  }
  
  /**
   * 연결 처리
   */
  private handleConnection(socket: Socket, user: SocketUser): void {
    // 연결 저장
    this.connections.set(socket.id, socket);
    this.socketUsers.set(socket.id, user);
    
    // 사용자-소켓 매핑
    if (!this.userSockets.has(user.userId)) {
      this.userSockets.set(user.userId, new Set());
    }
    this.userSockets.get(user.userId)!.add(socket.id);
    
    // 사용자 룸 참가
    socket.join(`user:${user.userId}`);
    
    // 역할별 룸 참가
    socket.join(`role:${user.role}`);
    
    // 메트릭 업데이트
    this.metrics.totalConnections++;
    this.metrics.activeConnections++;
    if (this.metrics.activeConnections > this.metrics.peakConnections) {
      this.metrics.peakConnections = this.metrics.activeConnections;
    }
    
    // 온라인 상태 브로드캐스트
    this.broadcastUserStatus(user.userId, 'online');
  }
  
  /**
   * 연결 해제 처리
   */
  private handleDisconnection(socket: Socket, user: SocketUser, reason: string): void {
    console.log(`👋 사용자 연결 해제: ${user.username} (${reason})`);
    
    // 연결 제거
    this.connections.delete(socket.id);
    this.socketUsers.delete(socket.id);
    
    // 사용자-소켓 매핑 제거
    const userSockets = this.userSockets.get(user.userId);
    if (userSockets) {
      userSockets.delete(socket.id);
      
      // 모든 소켓이 끊어졌으면 오프라인 처리
      if (userSockets.size === 0) {
        this.userSockets.delete(user.userId);
        this.broadcastUserStatus(user.userId, 'offline');
      }
    }
    
    // 메트릭 업데이트
    this.metrics.activeConnections--;
  }
  
  /**
   * 채팅 네임스페이스 설정
   */
  private setupChatNamespace(namespace: any): void {
    namespace.on('connection', (socket: Socket) => {
      const user = (socket as any).user as SocketUser;
      
      // 채팅 룸 참가
      socket.on('join-room', async (roomId: string) => {
        // 권한 확인
        const hasAccess = await this.checkChatRoomAccess(user.userId, roomId);
        if (!hasAccess) {
          socket.emit('error', { message: '채팅방 접근 권한이 없습니다.' });
          return;
        }
        
        socket.join(`chat:${roomId}`);
        socket.to(`chat:${roomId}`).emit('user-joined', {
          userId: user.userId,
          username: user.username,
        });
      });
      
      // 메시지 전송
      socket.on('send-message', async (data: any) => {
        this.metrics.messagesReceived++;
        
        // 메시지 저장 및 브로드캐스트
        const message = await this.saveChatMessage(user.userId, data);
        
        namespace.to(`chat:${data.roomId}`).emit('new-message', message);
        this.metrics.messagesSent++;
      });
      
      // 타이핑 표시
      socket.on('typing', (roomId: string) => {
        socket.to(`chat:${roomId}`).emit('user-typing', {
          userId: user.userId,
          username: user.username,
        });
      });
      
      // 타이핑 중지
      socket.on('stop-typing', (roomId: string) => {
        socket.to(`chat:${roomId}`).emit('user-stop-typing', {
          userId: user.userId,
        });
      });
    });
  }
  
  /**
   * 알림 네임스페이스 설정
   */
  private setupNotificationNamespace(namespace: any): void {
    namespace.on('connection', (socket: Socket) => {
      const user = (socket as any).user as SocketUser;
      
      // 알림 구독
      socket.on('subscribe', () => {
        socket.join(`notifications:${user.userId}`);
      });
      
      // 알림 읽음 처리
      socket.on('mark-read', async (notificationId: string) => {
        await this.markNotificationAsRead(user.userId, notificationId);
      });
      
      // 모든 알림 읽음
      socket.on('mark-all-read', async () => {
        await this.markAllNotificationsAsRead(user.userId);
      });
    });
  }
  
  /**
   * 관리자 네임스페이스 설정
   */
  private setupAdminNamespace(namespace: any): void {
    // 관리자 인증 미들웨어
    namespace.use(async (socket: Socket, next: any) => {
      const user = (socket as any).user as SocketUser;
      
      if (user.role !== 'ADMIN') {
        return next(new Error('관리자 권한이 필요합니다.'));
      }
      
      next();
    });
    
    namespace.on('connection', (socket: Socket) => {
      const user = (socket as any).user as SocketUser;
      
      // 실시간 메트릭 구독
      socket.on('subscribe-metrics', () => {
        socket.join('admin:metrics');
      });
      
      // 시스템 알림 전송
      socket.on('broadcast-system', (message: string) => {
        this.io?.emit('system-message', {
          message,
          timestamp: new Date(),
          from: user.username,
        });
      });
      
      // 사용자 강제 종료
      socket.on('kick-user', (userId: string) => {
        this.kickUser(userId);
      });
    });
  }
  
  /**
   * 사용자에게 메시지 전송
   */
  async sendToUser(userId: string, event: string, data: any): Promise<void> {
    if (!this.io) return;
    
    this.io.to(`user:${userId}`).emit(event, data);
    this.metrics.messagesSent++;
  }
  
  /**
   * 역할별 메시지 전송
   */
  async sendToRole(role: string, event: string, data: any): Promise<void> {
    if (!this.io) return;
    
    this.io.to(`role:${role}`).emit(event, data);
    this.metrics.messagesSent++;
  }
  
  /**
   * 모든 사용자에게 메시지 전송
   */
  async broadcast(event: string, data: any): Promise<void> {
    if (!this.io) return;
    
    this.io.emit(event, data);
    this.metrics.messagesSent++;
  }
  
  /**
   * 사용자 상태 브로드캐스트
   */
  private broadcastUserStatus(userId: string, status: 'online' | 'offline'): void {
    if (!this.io) return;
    
    this.io.emit('user-status', {
      userId,
      status,
      timestamp: new Date(),
    });
  }
  
  /**
   * 채팅방 접근 권한 확인
   */
  private async checkChatRoomAccess(userId: string, roomId: string): Promise<boolean> {
    try {
      // 사용자 정보 조회
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, isActive: true },
      });

      if (!user || !user.isActive) {
        return false;
      }

      // 관리자는 모든 방 접근 가능
      if (user.role === 'ADMIN' || user.role === 'MODERATOR') {
        return true;
      }

      // 공개 방인지 확인
      if (roomId.startsWith('public:')) {
        return true;
      }

      // 개인 방 접근 권한 확인
      if (roomId.startsWith('private:')) {
        const roomUsers = roomId.replace('private:', '').split('-').sort();
        return roomUsers.includes(userId);
      }

      // 게시글 댓글 방 접근 권한 확인
      if (roomId.startsWith('post:')) {
        const postId = roomId.replace('post:', '');
        const post = await db.post.findUnique({
          where: { id: postId },
          select: { 
            id: true, 
            isPublished: true,
            menu: { select: { isActive: true } }
          },
        });

        return post && post.isPublished && post.menu.isActive;
      }

      return false;
    } catch (error) {
      console.error('채팅방 접근 권한 확인 실패:', error);
      return false;
    }
  }
  
  /**
   * 채팅 메시지 저장
   */
  private async saveChatMessage(userId: string, data: any): Promise<any> {
    try {
      // 메시지 내용 검증 및 정화
      const content = this.sanitizeMessage(data.message || data.content);
      if (!content.trim()) {
        throw new Error('빈 메시지는 저장할 수 없습니다');
      }

      // 사용자 정보 조회
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { 
          id: true, 
          username: true, 
          name: true,
          profileImage: true,
          role: true
        },
      });

      if (!user) {
        throw new Error('사용자를 찾을 수 없습니다');
      }

      // Redis에 메시지 저장 (실시간 채팅)
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const message = {
        id: messageId,
        userId,
        username: user.username,
        name: user.name,
        profileImage: user.profileImage,
        role: user.role,
        content,
        roomId: data.roomId,
        timestamp: new Date().toISOString(),
        type: data.type || 'text',
        replyTo: data.replyTo || null,
      };

      // Redis 저장 (실시간 채팅용)
      const redis = getRedisCluster();
      await redis.zadd(
        `chat:${data.roomId}:messages`, 
        Date.now(), 
        JSON.stringify(message)
      );

      // 방별 최근 메시지 제한 (최근 1000개만 유지)
      await redis.zremrangebyrank(`chat:${data.roomId}:messages`, 0, -1001);

      // 중요한 메시지는 데이터베이스에도 저장
      if (data.permanent || data.roomId.startsWith('post:')) {
        try {
          if (data.roomId.startsWith('post:')) {
            const postId = data.roomId.replace('post:', '');
            await db.comment.create({
              data: {
                postId,
                authorId: userId,
                content,
              },
            });
          }
        } catch (dbError) {
          console.error('데이터베이스 메시지 저장 실패:', dbError);
        }
      }

      return message;
    } catch (error) {
      console.error('메시지 저장 실패:', error);
      throw error;
    }
  }

  /**
   * 메시지 내용 정화
   */
  private sanitizeMessage(content: string): string {
    if (typeof content !== 'string') return '';
    
    return content
      .trim()
      .slice(0, 2000) // 최대 2000자 제한
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // 스크립트 태그 제거
      .replace(/javascript:/gi, '') // javascript: 프로토콜 제거
      .replace(/on\w+\s*=/gi, ''); // 이벤트 핸들러 제거
  }
  
  /**
   * 알림 읽음 처리
   */
  private async markNotificationAsRead(userId: string, notificationId: string): Promise<void> {
    // TODO: 실제 알림 읽음 처리 로직 구현
  }
  
  /**
   * 모든 알림 읽음 처리
   */
  private async markAllNotificationsAsRead(userId: string): Promise<void> {
    // TODO: 실제 모든 알림 읽음 처리 로직 구현
  }
  
  /**
   * 사용자 강제 종료
   */
  private kickUser(userId: string): void {
    const socketIds = this.userSockets.get(userId);
    
    if (socketIds) {
      socketIds.forEach(socketId => {
        const socket = this.connections.get(socketId);
        if (socket) {
          socket.emit('kicked', { message: '관리자에 의해 연결이 종료되었습니다.' });
          socket.disconnect(true);
        }
      });
    }
  }
  
  /**
   * 온라인 사용자 조회
   */
  getOnlineUsers(): SocketUser[] {
    return Array.from(this.socketUsers.values());
  }
  
  /**
   * 사용자 온라인 확인
   */
  isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId);
  }
  
  /**
   * 메트릭 조회
   */
  getMetrics() {
    return {
      ...this.metrics,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
    };
  }
  
  /**
   * 메트릭 수집 시작
   */
  private startMetricsCollection(): void {
    // 1분마다 메트릭 브로드캐스트
    setInterval(() => {
      const metrics = this.getMetrics();
      
      // 관리자에게 메트릭 전송
      if (this.io) {
        this.io.of('/admin').to('admin:metrics').emit('metrics-update', metrics);
      }
      
      // 콘솔 로깅
      console.log('📊 Socket.IO 메트릭:', {
        active: metrics.activeConnections,
        peak: metrics.peakConnections,
        messages: metrics.messagesReceived + metrics.messagesSent,
        errors: metrics.errors,
      });
    }, 60000);
  }
  
  /**
   * 서버 종료
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Socket.IO 서버 종료 중...');
    
    if (this.io) {
      // 모든 연결 종료
      this.io.emit('server-shutdown', { message: '서버가 종료됩니다.' });
      
      // 클라이언트 연결 해제
      this.io.disconnectSockets(true);
      
      // 서버 종료
      this.io.close();
      
      this.io = null;
    }
    
    // 정리
    this.connections.clear();
    this.userSockets.clear();
    this.socketUsers.clear();
    
    console.log('✅ Socket.IO 서버 종료 완료');
  }
}

// 전역 Socket.IO 매니저 인스턴스
let globalSocketManager: SocketIOManager | null = null;

/**
 * Socket.IO 매니저 가져오기
 */
export function getSocketManager(): SocketIOManager {
  if (!globalSocketManager) {
    globalSocketManager = new SocketIOManager();
  }
  return globalSocketManager;
}

/**
 * Socket.IO 서버 초기화 헬퍼
 */
export async function initializeSocketIO(httpServer: HTTPServer): Promise<SocketIOManager> {
  const manager = getSocketManager();
  await manager.initialize(httpServer);
  return manager;
}