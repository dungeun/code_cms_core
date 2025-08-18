/**
 * Express 서버 (개발용)
 * Socket.IO는 별도 프로세스로 실행
 */

import express from 'express';
import compression from 'compression';
import morgan from 'morgan';
import { createRequestHandler } from '@remix-run/express';

const app = express();

// 압축 활성화
app.use(compression());

// HTTP 요청 로깅
app.use(morgan('tiny'));

// 정적 파일 제공
app.use(express.static('public'));

// Remix 핸들러
const MODE = process.env.NODE_ENV || 'development';
const BUILD_DIR = './build/index.js';

// Remix 요청 핸들러
if (MODE === 'production') {
  app.all('*', createRequestHandler({ 
    build: await import(BUILD_DIR),
    mode: MODE 
  }));
} else {
  // 개발 모드에서는 매 요청마다 빌드를 다시 로드
  app.all('*', async (req, res, next) => {
    try {
      // 캐시 무효화를 위한 타임스탬프 추가
      const build = await import(`${BUILD_DIR}?t=${Date.now()}`);
      return createRequestHandler({ 
        build, 
        mode: MODE 
      })(req, res, next);
    } catch (error) {
      console.error('빌드 로드 실패:', error);
      next(error);
    }
  });
}

// 에러 핸들링
app.use((err, req, res, next) => {
  console.error('서버 에러:', err);
  res.status(500).send('서버 에러가 발생했습니다.');
});

// 서버 시작
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Express 서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`   로컬: http://localhost:${PORT}`);
  
  if (MODE === 'development') {
    console.log(`   환경: 개발 모드`);
  }
});