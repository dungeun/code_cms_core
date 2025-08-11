// 파일 업로드 API 엔드포인트

import type { ActionFunction } from '@remix-run/node';
import { json, unstable_parseMultipartFormData, unstable_createMemoryUploadHandler } from '@remix-run/node';
import { processImage } from '../lib/media/image-optimization.server';
import { requireUser } from '../lib/auth.server';
import { db } from '~/utils/db.server';
import path from 'path';
import fs from 'fs/promises';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const action: ActionFunction = async ({ request }) => {
  try {
    const user = await requireUser(request);
    
    const uploadHandler = unstable_createMemoryUploadHandler({
      maxPartSize: MAX_FILE_SIZE,
    });

    const formData = await unstable_parseMultipartFormData(request, uploadHandler);
    const file = formData.get('file') as File;
    
    if (!file || !file.size) {
      return json({ error: '파일이 선택되지 않았습니다.' }, { status: 400 });
    }

    // 파일 타입 검증
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return json({ 
        error: '지원하지 않는 파일 형식입니다. (JPEG, PNG, WebP, GIF만 지원)' 
      }, { status: 400 });
    }

    // 파일명 생성
    const timestamp = Date.now();
    const extension = path.extname(file.name);
    const filename = `${timestamp}-${Math.random().toString(36).substring(7)}${extension}`;
    
    // 업로드 디렉토리 생성
    const uploadDir = path.join(process.cwd(), 'uploads');
    await fs.mkdir(uploadDir, { recursive: true });
    
    // 파일 저장
    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = path.join(uploadDir, filename);
    await fs.writeFile(filePath, buffer);
    
    // 이미지 최적화 및 썸네일 생성
    const optimizedPaths = await processImage(filePath, filename);
    
    // 데이터베이스에 파일 정보 저장
    const uploadedFile = await db.file.create({
      data: {
        filename: filename,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        path: `/uploads/${filename}`,
        thumbnailPath: optimizedPaths.thumbnail,
        optimizedPath: optimizedPaths.optimized,
        uploadedById: user.id,
      },
    });

    return json({
      success: true,
      file: {
        id: uploadedFile.id,
        filename: uploadedFile.filename,
        originalName: uploadedFile.originalName,
        path: uploadedFile.path,
        thumbnailPath: uploadedFile.thumbnailPath,
        optimizedPath: uploadedFile.optimizedPath,
        size: uploadedFile.size,
        url: `/uploads/${filename}`,
        thumbnailUrl: optimizedPaths.thumbnail,
      }
    });

  } catch (error) {
    console.error('File upload error:', error);
    
    return json({ 
      error: '파일 업로드 중 오류가 발생했습니다.' 
    }, { status: 500 });
  }
};