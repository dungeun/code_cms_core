/**
 * 플러그인 시스템용 데이터베이스 클라이언트 래퍼
 * 
 * 플러그인이 안전하게 데이터베이스에 접근할 수 있도록 제한된 인터페이스 제공
 */

import { prisma } from '~/lib/db.server';
import type { PrismaClient } from '@prisma/client';

export interface DatabaseClient {
  // 사용자 관련 메서드
  user: {
    findMany: typeof prisma.user.findMany;
    findUnique: typeof prisma.user.findUnique;
    findFirst: typeof prisma.user.findFirst;
    count: typeof prisma.user.count;
  };
  
  // 포스트 관련 메서드
  post: {
    findMany: typeof prisma.post.findMany;
    findUnique: typeof prisma.post.findUnique;
    findFirst: typeof prisma.post.findFirst;
    count: typeof prisma.post.count;
    create: typeof prisma.post.create;
    update: typeof prisma.post.update;
    delete: typeof prisma.post.delete;
  };
  
  // 댓글 관련 메서드
  comment: {
    findMany: typeof prisma.comment.findMany;
    findUnique: typeof prisma.comment.findUnique;
    count: typeof prisma.comment.count;
    create: typeof prisma.comment.create;
    update: typeof prisma.comment.update;
    delete: typeof prisma.comment.delete;
  };
  
  // 플러그인 데이터 전용 메서드
  pluginData: {
    findMany: typeof prisma.pluginData.findMany;
    findUnique: typeof prisma.pluginData.findUnique;
    create: typeof prisma.pluginData.create;
    update: typeof prisma.pluginData.update;
    delete: typeof prisma.pluginData.delete;
    upsert: typeof prisma.pluginData.upsert;
  };
  
  // 트랜잭션 메서드
  $transaction: typeof prisma.$transaction;
}

/**
 * 플러그인용 제한된 데이터베이스 클라이언트 생성
 * 
 * @param pluginId 플러그인 ID (보안 및 추적용)
 * @returns 제한된 데이터베이스 클라이언트
 */
export function createPluginDatabaseClient(pluginId: string): DatabaseClient {
  // 플러그인 데이터 접근 시 자동으로 pluginId 필터링
  const pluginDataMethods = {
    findMany: async (args?: any) => {
      return prisma.pluginData.findMany({
        ...args,
        where: {
          ...args?.where,
          pluginId
        }
      });
    },
    
    findUnique: async (args: any) => {
      return prisma.pluginData.findUnique({
        ...args,
        where: {
          ...args.where,
          pluginId
        }
      });
    },
    
    create: async (args: any) => {
      return prisma.pluginData.create({
        ...args,
        data: {
          ...args.data,
          pluginId
        }
      });
    },
    
    update: async (args: any) => {
      return prisma.pluginData.update({
        ...args,
        where: {
          ...args.where,
          pluginId
        }
      });
    },
    
    delete: async (args: any) => {
      return prisma.pluginData.delete({
        ...args,
        where: {
          ...args.where,
          pluginId
        }
      });
    },
    
    upsert: async (args: any) => {
      return prisma.pluginData.upsert({
        ...args,
        where: {
          ...args.where,
          pluginId
        },
        create: {
          ...args.create,
          pluginId
        }
      });
    }
  };

  return {
    // 읽기 전용 사용자 메서드
    user: {
      findMany: prisma.user.findMany,
      findUnique: prisma.user.findUnique,
      findFirst: prisma.user.findFirst,
      count: prisma.user.count
    },
    
    // 포스트 메서드 (플러그인이 콘텐츠를 생성/수정할 수 있음)
    post: {
      findMany: prisma.post.findMany,
      findUnique: prisma.post.findUnique,
      findFirst: prisma.post.findFirst,
      count: prisma.post.count,
      create: prisma.post.create,
      update: prisma.post.update,
      delete: prisma.post.delete
    },
    
    // 댓글 메서드
    comment: {
      findMany: prisma.comment.findMany,
      findUnique: prisma.comment.findUnique,
      count: prisma.comment.count,
      create: prisma.comment.create,
      update: prisma.comment.update,
      delete: prisma.comment.delete
    },
    
    // 플러그인 전용 데이터 (자동으로 pluginId 필터링)
    pluginData: pluginDataMethods,
    
    // 트랜잭션 (조심스럽게 사용)
    $transaction: prisma.$transaction
  };
}

/**
 * 플러그인 데이터 스키마 확장
 * 
 * 데이터베이스 스키마에 다음을 추가해야 함:
 * 
 * model PluginData {
 *   id        String   @id @default(cuid())
 *   pluginId  String
 *   key       String
 *   value     Json
 *   createdAt DateTime @default(now())
 *   updatedAt DateTime @updatedAt
 *   
 *   @@unique([pluginId, key])
 * }
 */