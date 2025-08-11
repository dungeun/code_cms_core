/**
 * 채팅방 컴포넌트
 * 실시간 채팅 UI
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { ko } from 'date-fns/locale';
import { 
  Send, 
  Paperclip, 
  Smile, 
  MoreVertical,
  Edit2,
  Trash2,
  Reply,
  Copy,
  Check,
  CheckCheck,
} from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { ScrollArea } from '~/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';
import { useSocket } from '~/hooks/useSocketConnection';
import { cn } from '~/lib/utils';
import { krToast } from '~/components/ui/kr/sonner-kr';

interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  user: {
    id: string;
    username: string;
    avatar?: string;
  };
  content: string;
  type: 'text' | 'image' | 'file' | 'emoji' | 'system';
  metadata?: Record<string, any>;
  reactions?: Record<string, string[]>;
  editedAt?: Date;
  deletedAt?: Date;
  createdAt: Date;
  isRead?: boolean;
}

interface ChatRoomProps {
  roomId: string;
  currentUserId: string;
  className?: string;
}

export function ChatRoom({ roomId, currentUserId, className }: ChatRoomProps) {
  const socket = useSocket('/chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [editingMessage, setEditingMessage] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 메시지 로드
  useEffect(() => {
    if (!socket) return;

    // 메시지 히스토리 요청
    socket.emit('message:history', { roomId, limit: 50 });

    // 이벤트 리스너
    const handleNewMessage = (message: ChatMessage) => {
      if (message.roomId === roomId) {
        setMessages(prev => [...prev, message]);
        scrollToBottom();
        
        // 다른 사용자의 메시지인 경우 읽음 처리
        if (message.userId !== currentUserId) {
          socket.emit('message:read', { roomId, messageId: message.id });
        }
      }
    };

    const handleMessageEdited = (message: ChatMessage) => {
      setMessages(prev => prev.map(msg => 
        msg.id === message.id ? message : msg
      ));
    };

    const handleMessageDeleted = ({ messageId }: { messageId: string }) => {
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, deletedAt: new Date() } : msg
      ));
    };

    const handleTypingUsers = ({ users }: { roomId: string; users: string[] }) => {
      setTypingUsers(users.filter(id => id !== currentUserId));
    };

    const handleHistoryResult = (historyMessages: ChatMessage[]) => {
      setMessages(historyMessages.reverse());
      scrollToBottom();
    };

    const handleReactionAdded = ({ messageId, userId, emoji }: any) => {
      setMessages(prev => prev.map(msg => {
        if (msg.id === messageId) {
          const reactions = msg.reactions || {};
          if (!reactions[emoji]) {
            reactions[emoji] = [];
          }
          reactions[emoji].push(userId);
          return { ...msg, reactions };
        }
        return msg;
      }));
    };

    const handleReactionRemoved = ({ messageId, userId, emoji }: any) => {
      setMessages(prev => prev.map(msg => {
        if (msg.id === messageId) {
          const reactions = msg.reactions || {};
          if (reactions[emoji]) {
            reactions[emoji] = reactions[emoji].filter(id => id !== userId);
            if (reactions[emoji].length === 0) {
              delete reactions[emoji];
            }
          }
          return { ...msg, reactions };
        }
        return msg;
      }));
    };

    socket.on('message:new', handleNewMessage);
    socket.on('message:edited', handleMessageEdited);
    socket.on('message:deleted', handleMessageDeleted);
    socket.on('typing:users', handleTypingUsers);
    socket.on('message:history:result', handleHistoryResult);
    socket.on('reaction:added', handleReactionAdded);
    socket.on('reaction:removed', handleReactionRemoved);

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('message:edited', handleMessageEdited);
      socket.off('message:deleted', handleMessageDeleted);
      socket.off('typing:users', handleTypingUsers);
      socket.off('message:history:result', handleHistoryResult);
      socket.off('reaction:added', handleReactionAdded);
      socket.off('reaction:removed', handleReactionRemoved);
    };
  }, [socket, roomId, currentUserId]);

  // 자동 스크롤
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 메시지 전송
  const sendMessage = () => {
    if (!socket || !inputMessage.trim()) return;

    const messageData = {
      roomId,
      content: inputMessage,
      type: 'text' as const,
      replyTo: replyingTo?.id,
    };

    socket.emit('message:send', messageData);
    setInputMessage('');
    setReplyingTo(null);
    handleTypingStop();
  };

  // 타이핑 시작
  const handleTypingStart = () => {
    if (!socket || isTyping) return;
    
    setIsTyping(true);
    socket.emit('typing:start', { roomId, isTyping: true });
    
    // 타이핑 종료 타이머
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      handleTypingStop();
    }, 3000);
  };

  // 타이핑 종료
  const handleTypingStop = () => {
    if (!socket || !isTyping) return;
    
    setIsTyping(false);
    socket.emit('typing:stop', { roomId, isTyping: false });
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  // 메시지 수정
  const handleEditMessage = (messageId: string, content: string) => {
    if (!socket) return;
    
    socket.emit('message:edit', { messageId, content });
    setEditingMessage(null);
  };

  // 메시지 삭제
  const handleDeleteMessage = (messageId: string) => {
    if (!socket) return;
    
    socket.emit('message:delete', { messageId });
  };

  // 반응 추가/제거
  const handleReaction = (messageId: string, emoji: string) => {
    if (!socket) return;
    
    const message = messages.find(msg => msg.id === messageId);
    const reactions = message?.reactions || {};
    const hasReacted = reactions[emoji]?.includes(currentUserId);
    
    if (hasReacted) {
      socket.emit('reaction:remove', { messageId, emoji });
    } else {
      socket.emit('reaction:add', { messageId, emoji });
    }
  };

  // 파일 업로드
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !socket) return;

    // FormData로 파일 업로드 처리
    const formData = new FormData();
    formData.append('file', file);
    formData.append('roomId', roomId);

    try {
      const response = await fetch('/api/chat/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (data.url) {
        socket.emit('message:send', {
          roomId,
          content: data.url,
          type: file.type.startsWith('image/') ? 'image' : 'file',
          metadata: {
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
          },
        });
      }
    } catch (error) {
      krToast.error('파일 업로드 실패');
    }
  };

  // 메시지 복사
  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    krToast.success('메시지가 복사되었습니다.');
  };

  // 날짜 포맷
  const formatDate = (date: Date) => {
    const messageDate = new Date(date);
    
    if (isToday(messageDate)) {
      return '오늘';
    } else if (isYesterday(messageDate)) {
      return '어제';
    } else {
      return format(messageDate, 'yyyy년 MM월 dd일', { locale: ko });
    }
  };

  // 시간 포맷
  const formatTime = (date: Date) => {
    return format(new Date(date), 'a h:mm', { locale: ko });
  };

  // 메시지 그룹핑
  const groupedMessages = messages.reduce((groups, message) => {
    const date = formatDate(message.createdAt);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {} as Record<string, ChatMessage[]>);

  const emojiReactions = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* 메시지 영역 */}
      <ScrollArea className="flex-1 p-4">
        {Object.entries(groupedMessages).map(([date, messages]) => (
          <div key={date}>
            {/* 날짜 구분선 */}
            <div className="flex items-center my-4">
              <div className="flex-1 border-t" />
              <span className="px-3 text-xs text-muted-foreground">{date}</span>
              <div className="flex-1 border-t" />
            </div>

            {/* 메시지 목록 */}
            {messages.map((message, index) => {
              const isOwn = message.userId === currentUserId;
              const showAvatar = !isOwn && (
                index === 0 || 
                messages[index - 1]?.userId !== message.userId ||
                new Date(message.createdAt).getTime() - new Date(messages[index - 1].createdAt).getTime() > 60000
              );

              if (message.type === 'system') {
                return (
                  <div key={message.id} className="flex justify-center my-2">
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                      {message.content}
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={message.id}
                  className={cn(
                    'flex gap-2 mb-2',
                    isOwn ? 'justify-end' : 'justify-start'
                  )}
                >
                  {!isOwn && showAvatar && (
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={message.user.avatar} />
                      <AvatarFallback>
                        {message.user.username[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  )}

                  {!isOwn && !showAvatar && <div className="w-8" />}

                  <div className={cn('flex flex-col', isOwn && 'items-end')}>
                    {!isOwn && showAvatar && (
                      <span className="text-xs text-muted-foreground mb-1">
                        {message.user.username}
                      </span>
                    )}

                    <div className="flex items-end gap-1">
                      {isOwn && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              <MoreVertical className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditingMessage(message.id)}>
                              <Edit2 className="h-4 w-4 mr-2" />
                              수정
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteMessage(message.id)}>
                              <Trash2 className="h-4 w-4 mr-2" />
                              삭제
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => copyMessage(message.content)}>
                              <Copy className="h-4 w-4 mr-2" />
                              복사
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}

                      <div
                        className={cn(
                          'px-3 py-2 rounded-lg max-w-md',
                          isOwn
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted',
                          message.deletedAt && 'opacity-50 line-through'
                        )}
                      >
                        {editingMessage === message.id ? (
                          <Input
                            defaultValue={message.content}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleEditMessage(message.id, e.currentTarget.value);
                              } else if (e.key === 'Escape') {
                                setEditingMessage(null);
                              }
                            }}
                            autoFocus
                          />
                        ) : (
                          <>
                            <p className="text-sm">{message.content}</p>
                            {message.editedAt && (
                              <span className="text-xs opacity-70">(수정됨)</span>
                            )}
                          </>
                        )}

                        {/* 반응 */}
                        {message.reactions && Object.keys(message.reactions).length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {Object.entries(message.reactions).map(([emoji, users]) => (
                              <button
                                key={emoji}
                                onClick={() => handleReaction(message.id, emoji)}
                                className={cn(
                                  'px-1 py-0.5 rounded text-xs bg-background/50',
                                  users.includes(currentUserId) && 'ring-1 ring-primary'
                                )}
                              >
                                {emoji} {users.length}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {!isOwn && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              <Smile className="h-3 w-3" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-2">
                            <div className="flex gap-1">
                              {emojiReactions.map(emoji => (
                                <button
                                  key={emoji}
                                  onClick={() => handleReaction(message.id, emoji)}
                                  className="p-1 hover:bg-muted rounded"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>

                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {formatTime(message.createdAt)}
                      </span>
                      {isOwn && message.isRead && (
                        <CheckCheck className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {/* 타이핑 표시 */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="flex gap-1">
              <span className="animate-bounce">●</span>
              <span className="animate-bounce animation-delay-100">●</span>
              <span className="animate-bounce animation-delay-200">●</span>
            </div>
            <span>
              {typingUsers.length === 1
                ? '입력 중...'
                : `${typingUsers.length}명이 입력 중...`}
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </ScrollArea>

      {/* 답장 표시 */}
      {replyingTo && (
        <div className="px-4 py-2 bg-muted/50 border-t flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Reply className="h-4 w-4 text-muted-foreground" />
            <div className="text-sm">
              <span className="font-medium">{replyingTo.user.username}</span>
              <p className="text-muted-foreground truncate max-w-xs">
                {replyingTo.content}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setReplyingTo(null)}
          >
            ×
          </Button>
        </div>
      )}

      {/* 입력 영역 */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileUpload}
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="h-4 w-4" />
          </Button>

          <Input
            value={inputMessage}
            onChange={(e) => {
              setInputMessage(e.target.value);
              handleTypingStart();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="메시지를 입력하세요..."
            className="flex-1"
          />

          <Button onClick={sendMessage} disabled={!inputMessage.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}