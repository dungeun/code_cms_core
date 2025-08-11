/**
 * 실시간 채팅 서버
 * Socket.IO를 활용한 실시간 채팅 시스템
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { prisma } from '~/lib/prisma.server';
import { getRedisClient } from '~/lib/redis.server';
import { verifyToken } from '~/lib/auth.server';
import { z } from 'zod';

// 메시지 스키마
const MessageSchema = z.object({
  roomId: z.string(),
  content: z.string().min(1).max(1000),
  type: z.enum(['text', 'image', 'file', 'emoji', 'system']).default('text'),
  metadata: z.record(z.any()).optional(),
});

const TypingSchema = z.object({
  roomId: z.string(),
  isTyping: z.boolean(),
});

const ReactionSchema = z.object({
  messageId: z.string(),
  emoji: z.string(),
});

export interface ChatUser {
  id: string;
  username: string;
  avatar?: string;
  status: 'online' | 'away' | 'offline';
  lastSeen: Date;
}

export interface ChatRoom {
  id: string;
  name: string;
  type: 'direct' | 'group' | 'channel';
  participants: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  lastMessage?: ChatMessage;
  unreadCount?: number;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'emoji' | 'system';
  metadata?: Record<string, any>;
  reactions?: Record<string, string[]>;
  editedAt?: Date;
  deletedAt?: Date;
  createdAt: Date;
}

export class ChatManager {
  private io: SocketIOServer;
  private redis = getRedisClient();
  private userSockets = new Map<string, Set<string>>();
  private socketUsers = new Map<string, string>();
  private typingUsers = new Map<string, Set<string>>();

  constructor(io: SocketIOServer) {
    this.io = io;
    this.setupNamespace();
  }

  private setupNamespace() {
    const chatNamespace = this.io.of('/chat');

    // 인증 미들웨어
    chatNamespace.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        const user = await verifyToken(token);
        
        if (!user) {
          return next(new Error('Authentication failed'));
        }

        socket.data.user = user;
        next();
      } catch (error) {
        next(new Error('Authentication failed'));
      }
    });

    chatNamespace.on('connection', (socket) => {
      this.handleConnection(socket);
    });
  }

  private async handleConnection(socket: Socket) {
    const userId = socket.data.user.id;
    console.log(`User ${userId} connected to chat`);

    // 사용자 소켓 매핑
    this.socketUsers.set(socket.id, userId);
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socket.id);

    // 사용자 상태 업데이트
    await this.updateUserStatus(userId, 'online');

    // 사용자의 채팅방 참여
    const rooms = await this.getUserRooms(userId);
    for (const room of rooms) {
      socket.join(`room:${room.id}`);
      
      // 읽지 않은 메시지 수 전송
      const unreadCount = await this.getUnreadCount(room.id, userId);
      socket.emit('room:unread', { roomId: room.id, count: unreadCount });
    }

    // 온라인 사용자 목록 전송
    const onlineUsers = await this.getOnlineUsers();
    socket.emit('users:online', onlineUsers);

    // 이벤트 핸들러 등록
    this.setupEventHandlers(socket);

    // 연결 해제 처리
    socket.on('disconnect', async () => {
      await this.handleDisconnect(socket);
    });
  }

  private setupEventHandlers(socket: Socket) {
    const userId = socket.data.user.id;

    // 메시지 전송
    socket.on('message:send', async (data) => {
      try {
        const validated = MessageSchema.parse(data);
        const message = await this.sendMessage(userId, validated);
        
        // 룸의 모든 참여자에게 메시지 전송
        this.io.of('/chat').to(`room:${validated.roomId}`).emit('message:new', message);
        
        // 푸시 알림 전송 (오프라인 사용자)
        await this.sendPushNotifications(validated.roomId, userId, message);
      } catch (error) {
        socket.emit('error', { message: '메시지 전송 실패' });
      }
    });

    // 메시지 수정
    socket.on('message:edit', async (data) => {
      const { messageId, content } = data;
      
      try {
        const message = await this.editMessage(messageId, userId, content);
        if (message) {
          this.io.of('/chat').to(`room:${message.roomId}`).emit('message:edited', message);
        }
      } catch (error) {
        socket.emit('error', { message: '메시지 수정 실패' });
      }
    });

    // 메시지 삭제
    socket.on('message:delete', async (data) => {
      const { messageId } = data;
      
      try {
        const message = await this.deleteMessage(messageId, userId);
        if (message) {
          this.io.of('/chat').to(`room:${message.roomId}`).emit('message:deleted', {
            messageId,
            roomId: message.roomId,
          });
        }
      } catch (error) {
        socket.emit('error', { message: '메시지 삭제 실패' });
      }
    });

    // 타이핑 상태
    socket.on('typing:start', async (data) => {
      try {
        const validated = TypingSchema.parse(data);
        this.handleTyping(userId, validated.roomId, true);
      } catch (error) {
        // 무시
      }
    });

    socket.on('typing:stop', async (data) => {
      try {
        const validated = TypingSchema.parse(data);
        this.handleTyping(userId, validated.roomId, false);
      } catch (error) {
        // 무시
      }
    });

    // 메시지 읽음 처리
    socket.on('message:read', async (data) => {
      const { roomId, messageId } = data;
      
      try {
        await this.markAsRead(roomId, userId, messageId);
        socket.to(`room:${roomId}`).emit('message:read', {
          roomId,
          userId,
          messageId,
        });
      } catch (error) {
        // 무시
      }
    });

    // 반응 추가
    socket.on('reaction:add', async (data) => {
      try {
        const validated = ReactionSchema.parse(data);
        const message = await this.addReaction(validated.messageId, userId, validated.emoji);
        
        if (message) {
          this.io.of('/chat').to(`room:${message.roomId}`).emit('reaction:added', {
            messageId: validated.messageId,
            userId,
            emoji: validated.emoji,
          });
        }
      } catch (error) {
        socket.emit('error', { message: '반응 추가 실패' });
      }
    });

    // 반응 제거
    socket.on('reaction:remove', async (data) => {
      try {
        const validated = ReactionSchema.parse(data);
        const message = await this.removeReaction(validated.messageId, userId, validated.emoji);
        
        if (message) {
          this.io.of('/chat').to(`room:${message.roomId}`).emit('reaction:removed', {
            messageId: validated.messageId,
            userId,
            emoji: validated.emoji,
          });
        }
      } catch (error) {
        socket.emit('error', { message: '반응 제거 실패' });
      }
    });

    // 채팅방 생성
    socket.on('room:create', async (data) => {
      const { name, type, participants } = data;
      
      try {
        const room = await this.createRoom(userId, name, type, participants);
        
        // 모든 참여자를 룸에 참여시킴
        for (const participantId of room.participants) {
          const participantSockets = this.userSockets.get(participantId);
          if (participantSockets) {
            participantSockets.forEach(socketId => {
              const participantSocket = this.io.of('/chat').sockets.get(socketId);
              if (participantSocket) {
                participantSocket.join(`room:${room.id}`);
                participantSocket.emit('room:created', room);
              }
            });
          }
        }
      } catch (error) {
        socket.emit('error', { message: '채팅방 생성 실패' });
      }
    });

    // 채팅방 나가기
    socket.on('room:leave', async (data) => {
      const { roomId } = data;
      
      try {
        await this.leaveRoom(roomId, userId);
        socket.leave(`room:${roomId}`);
        socket.emit('room:left', { roomId });
        
        // 시스템 메시지 전송
        const systemMessage = await this.sendSystemMessage(
          roomId,
          `${socket.data.user.username}님이 채팅방을 나갔습니다.`
        );
        
        socket.to(`room:${roomId}`).emit('message:new', systemMessage);
      } catch (error) {
        socket.emit('error', { message: '채팅방 나가기 실패' });
      }
    });

    // 메시지 검색
    socket.on('message:search', async (data) => {
      const { roomId, query, limit = 20, offset = 0 } = data;
      
      try {
        const messages = await this.searchMessages(roomId, query, limit, offset);
        socket.emit('message:search:result', messages);
      } catch (error) {
        socket.emit('error', { message: '메시지 검색 실패' });
      }
    });

    // 메시지 히스토리
    socket.on('message:history', async (data) => {
      const { roomId, before, limit = 50 } = data;
      
      try {
        const messages = await this.getMessageHistory(roomId, before, limit);
        socket.emit('message:history:result', messages);
      } catch (error) {
        socket.emit('error', { message: '메시지 히스토리 조회 실패' });
      }
    });
  }

  private async handleDisconnect(socket: Socket) {
    const userId = this.socketUsers.get(socket.id);
    
    if (userId) {
      // 소켓 매핑 제거
      this.socketUsers.delete(socket.id);
      const userSockets = this.userSockets.get(userId);
      
      if (userSockets) {
        userSockets.delete(socket.id);
        
        // 사용자의 모든 소켓이 끊어진 경우
        if (userSockets.size === 0) {
          this.userSockets.delete(userId);
          await this.updateUserStatus(userId, 'offline');
          
          // 타이핑 상태 제거
          this.typingUsers.forEach((users, roomId) => {
            if (users.has(userId)) {
              users.delete(userId);
              this.io.of('/chat').to(`room:${roomId}`).emit('typing:users', {
                roomId,
                users: Array.from(users),
              });
            }
          });
        }
      }
    }
  }

  // 메시지 전송
  private async sendMessage(userId: string, data: z.infer<typeof MessageSchema>) {
    const message = await prisma.chatMessage.create({
      data: {
        roomId: data.roomId,
        userId,
        content: data.content,
        type: data.type,
        metadata: data.metadata,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    // 룸 업데이트
    await prisma.chatRoom.update({
      where: { id: data.roomId },
      data: {
        lastMessageId: message.id,
        updatedAt: new Date(),
      },
    });

    // Redis에 캐시
    await this.redis.zadd(
      `room:${data.roomId}:messages`,
      Date.now(),
      JSON.stringify(message)
    );

    return message;
  }

  // 메시지 수정
  private async editMessage(messageId: string, userId: string, content: string) {
    const message = await prisma.chatMessage.findFirst({
      where: {
        id: messageId,
        userId,
        deletedAt: null,
      },
    });

    if (!message) {
      throw new Error('메시지를 찾을 수 없습니다.');
    }

    return await prisma.chatMessage.update({
      where: { id: messageId },
      data: {
        content,
        editedAt: new Date(),
      },
    });
  }

  // 메시지 삭제
  private async deleteMessage(messageId: string, userId: string) {
    const message = await prisma.chatMessage.findFirst({
      where: {
        id: messageId,
        userId,
      },
    });

    if (!message) {
      throw new Error('메시지를 찾을 수 없습니다.');
    }

    return await prisma.chatMessage.update({
      where: { id: messageId },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  // 타이핑 처리
  private handleTyping(userId: string, roomId: string, isTyping: boolean) {
    if (!this.typingUsers.has(roomId)) {
      this.typingUsers.set(roomId, new Set());
    }

    const roomTypingUsers = this.typingUsers.get(roomId)!;

    if (isTyping) {
      roomTypingUsers.add(userId);
    } else {
      roomTypingUsers.delete(userId);
    }

    // 타이핑 중인 사용자 목록 전송
    this.io.of('/chat').to(`room:${roomId}`).emit('typing:users', {
      roomId,
      users: Array.from(roomTypingUsers),
    });
  }

  // 반응 추가
  private async addReaction(messageId: string, userId: string, emoji: string) {
    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new Error('메시지를 찾을 수 없습니다.');
    }

    const reactions = (message.reactions as Record<string, string[]>) || {};
    
    if (!reactions[emoji]) {
      reactions[emoji] = [];
    }
    
    if (!reactions[emoji].includes(userId)) {
      reactions[emoji].push(userId);
    }

    return await prisma.chatMessage.update({
      where: { id: messageId },
      data: { reactions },
    });
  }

  // 반응 제거
  private async removeReaction(messageId: string, userId: string, emoji: string) {
    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new Error('메시지를 찾을 수 없습니다.');
    }

    const reactions = (message.reactions as Record<string, string[]>) || {};
    
    if (reactions[emoji]) {
      reactions[emoji] = reactions[emoji].filter(id => id !== userId);
      
      if (reactions[emoji].length === 0) {
        delete reactions[emoji];
      }
    }

    return await prisma.chatMessage.update({
      where: { id: messageId },
      data: { reactions },
    });
  }

  // 채팅방 생성
  private async createRoom(
    createdBy: string,
    name: string,
    type: 'direct' | 'group' | 'channel',
    participants: string[]
  ) {
    // 창작자 포함
    if (!participants.includes(createdBy)) {
      participants.push(createdBy);
    }

    // 1:1 채팅방 중복 체크
    if (type === 'direct' && participants.length === 2) {
      const existingRoom = await prisma.chatRoom.findFirst({
        where: {
          type: 'direct',
          AND: participants.map(id => ({
            participants: {
              has: id,
            },
          })),
        },
      });

      if (existingRoom) {
        return existingRoom;
      }
    }

    return await prisma.chatRoom.create({
      data: {
        name,
        type,
        participants,
        createdBy,
      },
    });
  }

  // 채팅방 나가기
  private async leaveRoom(roomId: string, userId: string) {
    const room = await prisma.chatRoom.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      throw new Error('채팅방을 찾을 수 없습니다.');
    }

    const participants = room.participants.filter(id => id !== userId);

    await prisma.chatRoom.update({
      where: { id: roomId },
      data: { participants },
    });
  }

  // 시스템 메시지 전송
  private async sendSystemMessage(roomId: string, content: string) {
    return await prisma.chatMessage.create({
      data: {
        roomId,
        userId: 'system',
        content,
        type: 'system',
      },
    });
  }

  // 사용자 상태 업데이트
  private async updateUserStatus(userId: string, status: 'online' | 'away' | 'offline') {
    await this.redis.hset(`user:${userId}`, 'status', status);
    await this.redis.hset(`user:${userId}`, 'lastSeen', Date.now().toString());

    // 상태 변경 알림
    this.io.of('/chat').emit('user:status', { userId, status });
  }

  // 사용자 채팅방 목록
  private async getUserRooms(userId: string): Promise<ChatRoom[]> {
    return await prisma.chatRoom.findMany({
      where: {
        participants: {
          has: userId,
        },
      },
      include: {
        lastMessage: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  // 읽지 않은 메시지 수
  private async getUnreadCount(roomId: string, userId: string): Promise<number> {
    const lastRead = await this.redis.hget(`user:${userId}:read`, roomId);
    const lastReadTime = lastRead ? parseInt(lastRead) : 0;

    return await prisma.chatMessage.count({
      where: {
        roomId,
        userId: {
          not: userId,
        },
        createdAt: {
          gt: new Date(lastReadTime),
        },
      },
    });
  }

  // 메시지 읽음 처리
  private async markAsRead(roomId: string, userId: string, messageId: string) {
    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
    });

    if (message) {
      await this.redis.hset(
        `user:${userId}:read`,
        roomId,
        message.createdAt.getTime().toString()
      );
    }
  }

  // 온라인 사용자 목록
  private async getOnlineUsers(): Promise<string[]> {
    return Array.from(this.userSockets.keys());
  }

  // 푸시 알림 전송
  private async sendPushNotifications(roomId: string, senderId: string, message: any) {
    const room = await prisma.chatRoom.findUnique({
      where: { id: roomId },
    });

    if (!room) return;

    const offlineUsers = room.participants.filter(
      id => id !== senderId && !this.userSockets.has(id)
    );

    // 오프라인 사용자에게 푸시 알림 전송 로직
    // 실제 구현은 FCM, APNs 등 사용
    for (const userId of offlineUsers) {
      console.log(`Push notification to ${userId}: ${message.content}`);
    }
  }

  // 메시지 검색
  private async searchMessages(roomId: string, query: string, limit: number, offset: number) {
    return await prisma.chatMessage.findMany({
      where: {
        roomId,
        content: {
          contains: query,
          mode: 'insensitive',
        },
        deletedAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    });
  }

  // 메시지 히스토리
  private async getMessageHistory(roomId: string, before?: string, limit: number = 50) {
    const where: any = {
      roomId,
      deletedAt: null,
    };

    if (before) {
      where.createdAt = {
        lt: new Date(before),
      };
    }

    return await prisma.chatMessage.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });
  }
}

// 싱글톤 인스턴스
let chatManagerInstance: ChatManager | null = null;

export function getChatManager(io: SocketIOServer): ChatManager {
  if (!chatManagerInstance) {
    chatManagerInstance = new ChatManager(io);
  }
  return chatManagerInstance;
}