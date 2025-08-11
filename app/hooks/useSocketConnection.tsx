/**
 * Socket.IO 연결 관리 React Hook
 * 컴포넌트에서 쉽게 Socket.IO를 사용할 수 있도록 하는 Hook
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSocket as useSocketClient, getSocketClient } from '~/lib/socket/socket.client';

interface UseSocketConnectionOptions {
  autoConnect?: boolean;
  token?: string;
  namespaces?: ('chat' | 'notification' | 'admin')[];
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onError?: (error: any) => void;
  onReconnect?: (attemptNumber: number) => void;
}

interface SocketConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;
  reconnectAttempts: number;
}

/**
 * Socket.IO 연결 관리 Hook
 */
export function useSocketConnection(options: UseSocketConnectionOptions = {}) {
  const {
    autoConnect = false,
    token,
    namespaces = [],
    onConnect,
    onDisconnect,
    onError,
    onReconnect,
  } = options;
  
  const socket = useSocketClient();
  const [state, setState] = useState<SocketConnectionState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    reconnectAttempts: 0,
  });
  
  const listenersRef = useRef<Map<string, Function>>(new Map());
  
  // 연결 함수
  const connect = useCallback(() => {
    if (!token) {
      setState(prev => ({
        ...prev,
        error: new Error('토큰이 필요합니다.'),
      }));
      return;
    }
    
    setState(prev => ({
      ...prev,
      isConnecting: true,
      error: null,
    }));
    
    // 기본 연결
    socket.connect(token);
    
    // 네임스페이스별 연결
    if (namespaces.includes('chat')) {
      socket.connectChat(token);
    }
    if (namespaces.includes('notification')) {
      socket.connectNotification(token);
    }
    if (namespaces.includes('admin')) {
      socket.connectAdmin(token);
    }
  }, [token, namespaces, socket]);
  
  // 연결 해제 함수
  const disconnect = useCallback(() => {
    socket.disconnect();
    setState(prev => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
    }));
  }, [socket]);
  
  // 재연결 함수
  const reconnect = useCallback(() => {
    socket.reconnect();
  }, [socket]);
  
  // 이벤트 리스너 설정
  useEffect(() => {
    // 연결 상태 리스너
    const handleConnectionStatus = (data: { status: string; reason?: string }) => {
      if (data.status === 'connected') {
        setState(prev => ({
          ...prev,
          isConnected: true,
          isConnecting: false,
          error: null,
        }));
        onConnect?.();
      } else if (data.status === 'disconnected') {
        setState(prev => ({
          ...prev,
          isConnected: false,
          isConnecting: false,
        }));
        onDisconnect?.(data.reason || 'unknown');
      }
    };
    
    // 재연결 중 리스너
    const handleReconnecting = (data: { attempt: number }) => {
      setState(prev => ({
        ...prev,
        isConnecting: true,
        reconnectAttempts: data.attempt,
      }));
    };
    
    // 재연결 성공 리스너
    const handleReconnected = (data: { attempts: number }) => {
      setState(prev => ({
        ...prev,
        isConnected: true,
        isConnecting: false,
        reconnectAttempts: 0,
      }));
      onReconnect?.(data.attempts);
    };
    
    // 에러 리스너
    const handleError = (data: { error: any }) => {
      setState(prev => ({
        ...prev,
        error: data.error,
      }));
      onError?.(data.error);
    };
    
    // 리스너 등록
    socket.on('connection-status', handleConnectionStatus);
    socket.on('reconnecting', handleReconnecting);
    socket.on('reconnected', handleReconnected);
    socket.on('error', handleError);
    
    // 리스너 저장
    listenersRef.current.set('connection-status', handleConnectionStatus);
    listenersRef.current.set('reconnecting', handleReconnecting);
    listenersRef.current.set('reconnected', handleReconnected);
    listenersRef.current.set('error', handleError);
    
    // 정리 함수
    return () => {
      listenersRef.current.forEach((listener, event) => {
        socket.off(event, listener);
      });
      listenersRef.current.clear();
    };
  }, [socket, onConnect, onDisconnect, onError, onReconnect]);
  
  // 자동 연결
  useEffect(() => {
    if (autoConnect && token && !state.isConnected && !state.isConnecting) {
      connect();
    }
  }, [autoConnect, token, state.isConnected, state.isConnecting, connect]);
  
  // 컴포넌트 언마운트 시 연결 해제
  useEffect(() => {
    return () => {
      if (state.isConnected) {
        disconnect();
      }
    };
  }, []);
  
  return {
    ...state,
    connect,
    disconnect,
    reconnect,
    socket,
  };
}

/**
 * 채팅 Hook
 */
export function useChat(roomId?: string) {
  const socket = useSocketClient();
  const [messages, setMessages] = useState<any[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  
  useEffect(() => {
    if (!roomId) return;
    
    // 메시지 수신
    const handleMessage = (message: any) => {
      setMessages(prev => [...prev, message]);
    };
    
    // 타이핑 상태
    const handleTyping = (data: { userId: string }) => {
      setTypingUsers(prev => new Set(prev).add(data.userId));
    };
    
    const handleStopTyping = (data: { userId: string }) => {
      setTypingUsers(prev => {
        const next = new Set(prev);
        next.delete(data.userId);
        return next;
      });
    };
    
    socket.on('chat:message', handleMessage);
    socket.on('chat:typing', handleTyping);
    socket.on('chat:stop-typing', handleStopTyping);
    
    // 방 참가
    socket.joinRoom(roomId);
    
    return () => {
      socket.off('chat:message', handleMessage);
      socket.off('chat:typing', handleTyping);
      socket.off('chat:stop-typing', handleStopTyping);
      socket.leaveRoom(roomId);
    };
  }, [roomId, socket]);
  
  const sendMessage = useCallback((message: string) => {
    if (!roomId) return;
    socket.sendMessage(roomId, message);
  }, [roomId, socket]);
  
  const startTyping = useCallback(() => {
    if (!roomId) return;
    socket.startTyping(roomId);
  }, [roomId, socket]);
  
  const stopTyping = useCallback(() => {
    if (!roomId) return;
    socket.stopTyping(roomId);
  }, [roomId, socket]);
  
  return {
    messages,
    typingUsers: Array.from(typingUsers),
    sendMessage,
    startTyping,
    stopTyping,
  };
}

/**
 * 알림 Hook
 */
export function useNotifications() {
  const socket = useSocketClient();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  
  useEffect(() => {
    // 새 알림
    const handleNewNotification = (notification: any) => {
      setNotifications(prev => [notification, ...prev]);
      if (!notification.read) {
        setUnreadCount(prev => prev + 1);
      }
    };
    
    // 알림 업데이트
    const handleUpdateNotification = (notification: any) => {
      setNotifications(prev => 
        prev.map(n => n.id === notification.id ? notification : n)
      );
      if (notification.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    };
    
    // 알림 삭제
    const handleDeleteNotification = (data: { id: string }) => {
      setNotifications(prev => {
        const notification = prev.find(n => n.id === data.id);
        if (notification && !notification.read) {
          setUnreadCount(count => Math.max(0, count - 1));
        }
        return prev.filter(n => n.id !== data.id);
      });
    };
    
    socket.on('notification:new', handleNewNotification);
    socket.on('notification:updated', handleUpdateNotification);
    socket.on('notification:deleted', handleDeleteNotification);
    
    // 알림 구독
    socket.subscribeNotifications();
    
    return () => {
      socket.off('notification:new', handleNewNotification);
      socket.off('notification:updated', handleUpdateNotification);
      socket.off('notification:deleted', handleDeleteNotification);
    };
  }, [socket]);
  
  const markAsRead = useCallback((notificationId: string) => {
    socket.markNotificationRead(notificationId);
  }, [socket]);
  
  const markAllAsRead = useCallback(() => {
    socket.markAllNotificationsRead();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }, [socket]);
  
  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
  };
}

/**
 * 사용자 상태 Hook
 */
export function useUserStatus() {
  const socket = useSocketClient();
  const [onlineUsers, setOnlineUsers] = useState<Map<string, boolean>>(new Map());
  
  useEffect(() => {
    const handleUserStatus = (data: { userId: string; status: 'online' | 'offline' }) => {
      setOnlineUsers(prev => {
        const next = new Map(prev);
        if (data.status === 'online') {
          next.set(data.userId, true);
        } else {
          next.delete(data.userId);
        }
        return next;
      });
    };
    
    socket.on('user-status', handleUserStatus);
    
    return () => {
      socket.off('user-status', handleUserStatus);
    };
  }, [socket]);
  
  const isUserOnline = useCallback((userId: string) => {
    return onlineUsers.get(userId) || false;
  }, [onlineUsers]);
  
  return {
    onlineUsers: Array.from(onlineUsers.keys()),
    isUserOnline,
  };
}

/**
 * 관리자 메트릭 Hook
 */
export function useAdminMetrics() {
  const socket = useSocketClient();
  const [metrics, setMetrics] = useState<any>(null);
  
  useEffect(() => {
    const handleMetricsUpdate = (data: any) => {
      setMetrics(data);
    };
    
    socket.on('admin:metrics', handleMetricsUpdate);
    socket.subscribeMetrics();
    
    return () => {
      socket.off('admin:metrics', handleMetricsUpdate);
    };
  }, [socket]);
  
  const broadcastSystemMessage = useCallback((message: string) => {
    socket.broadcastSystem(message);
  }, [socket]);
  
  const kickUser = useCallback((userId: string) => {
    socket.kickUser(userId);
  }, [socket]);
  
  return {
    metrics,
    broadcastSystemMessage,
    kickUser,
  };
}