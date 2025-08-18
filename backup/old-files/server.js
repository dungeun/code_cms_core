/**
 * Express 서버 + Socket.IO 통합
 * Remix와 Socket.IO를 함께 실행하는 서버 설정
 */

import express from 'express';
import { createServer } from 'http';
import { createRequestHandler } from '@remix-run/express';
import compression from 'compression';
import morgan from 'morgan';
import { initializeSocketIO } from './app/lib/socket/socket.server.js';

const app = express();
const httpServer = createServer(app);

// 압축 활성화
app.use(compression());

// HTTP 요청 로깅
app.use(morgan('tiny'));

// 정적 파일 제공
app.use(express.static('public'));

// Remix 핸들러
const MODE = process.env.NODE_ENV;
const BUILD_DIR = './build';

if (MODE === 'production') {
  app.all('*', createRequestHandler({ build: await import(BUILD_DIR) }));
} else {
  // 개발 모드에서는 매 요청마다 빌드를 다시 로드
  app.all('*', async (req, res, next) => {
    try {
      const build = await import(`${BUILD_DIR}?t=${Date.now()}`);
      return createRequestHandler({ build, mode: MODE })(req, res, next);
    } catch (error) {
      next(error);
    }
  });
}

// Socket.IO 서버 초기화
initializeSocketIO(httpServer)
  .then((socketManager) => {
    console.log('✅ Socket.IO 서버 초기화 완료');
    
    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('SIGTERM 신호 수신, 서버 종료 중...');
      await socketManager.shutdown();
      httpServer.close(() => {
        console.log('서버 종료 완료');
        process.exit(0);
      });
    });
    
    process.on('SIGINT', async () => {
      console.log('SIGINT 신호 수신, 서버 종료 중...');
      await socketManager.shutdown();
      httpServer.close(() => {
        console.log('서버 종료 완료');
        process.exit(0);
      });
    });
  })
  .catch((error) => {
    console.error('Socket.IO 서버 초기화 실패:', error);
    process.exit(1);
  });

// 서버 시작
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`   로컬: http://localhost:${PORT}`);
  
  if (MODE === 'development') {
    console.log(`   Socket.IO 클라이언트: http://localhost:${PORT}/socket.io/socket.io.js`);
  }
});

// 에러 핸들링
app.use((err, req, res, next) => {
  console.error('서버 에러:', err);
  res.status(500).send('서버 에러가 발생했습니다.');
});

export default httpServer;