# 블리CMS (BleeCMS)

> 현대적이고 확장 가능한 Remix 기반 콘텐츠 관리 시스템

## ✨ 주요 기능

### 🎯 핵심 기능
- **현대적 아키텍처**: Remix 기반의 풀스택 애플리케이션
- **한국형 CMS**: 한국 사용자를 위한 최적화된 UI/UX
- **실시간 기능**: WebSocket 기반 실시간 알림 및 채팅
- **소셜 로그인**: 카카오, 네이버 OAuth 통합
- **결제 시스템**: 토스페이먼츠 연동
- **SMS 알림**: 네이버 SENS 연동

### 🚀 성능 최적화
- **번들 최적화**: 동적 임포트 및 코드 스플리팅
- **데이터베이스**: PostgreSQL 읽기 복제본 지원
- **캐싱**: Redis 클러스터 기반 고성능 캐싱
- **이미지 최적화**: WebP/AVIF 자동 변환
- **CDN 지원**: 정적 자산 최적화

### 🔒 보안 강화
- **인증/인가**: JWT 기반 보안 시스템
- **CSRF 보호**: 토큰 기반 요청 보호
- **입력 검증**: Zod 스키마 기반 검증
- **보안 헤더**: CSP, HSTS, XSS 보호
- **레이트 리미팅**: API 호출 제한

### 📊 모니터링 & 관찰성
- **메트릭 수집**: Prometheus 연동
- **대시보드**: Grafana 시각화
- **로그 관리**: Loki 기반 로그 수집
- **알림 시스템**: Slack, 이메일 알림
- **헬스체크**: 자동 상태 모니터링

### 🧪 테스트 & 품질
- **단위 테스트**: Jest 기반 테스트
- **통합 테스트**: 데이터베이스 통합 테스트
- **E2E 테스트**: Playwright 자동화 테스트
- **코드 커버리지**: 100% 커버리지 목표
- **자동 생성**: AI 기반 테스트 자동 생성

### 🏗️ 아키텍처
- **플러그인 시스템**: 확장 가능한 플러그인 아키텍처
- **의존성 주입**: 모듈형 서비스 관리
- **API 게이트웨이**: 통합 API 관리
- **마이크로서비스**: 분산 서비스 지원

## 🛠️ 기술 스택

### Frontend
- **Remix**: 풀스택 React 프레임워크
- **TypeScript**: 정적 타입 검사
- **Tailwind CSS**: 유틸리티 기반 CSS
- **Shadcn/ui**: 모던 UI 컴포넌트
- **Zustand**: 상태 관리

### Backend
- **Node.js**: 서버 런타임
- **Prisma**: 타입 안전 ORM
- **PostgreSQL**: 관계형 데이터베이스
- **Redis**: 인메모리 캐싱
- **Socket.io**: 실시간 통신

### DevOps & 인프라
- **Docker**: 컨테이너화
- **Docker Compose**: 멀티 컨테이너 관리
- **Traefik**: 로드 밸런서 & SSL
- **Prometheus**: 메트릭 수집
- **Grafana**: 모니터링 대시보드

### 개발 도구
- **Jest**: 테스트 프레임워크
- **Playwright**: E2E 테스트
- **ESLint**: 코드 품질
- **Prettier**: 코드 포맷팅

## 📁 프로젝트 구조

```
blee-cms/
├── 📁 app/                    # 애플리케이션 소스
│   ├── 📁 components/         # React 컴포넌트
│   ├── 📁 lib/               # 서버 사이드 로직
│   ├── 📁 routes/            # Remix 라우트
│   └── 📁 stores/            # 상태 관리
├── 📁 backup/                # 백업 파일들
│   ├── 📁 old-files/         # 구버전 파일
│   ├── 📁 archived-docs/     # 아카이브 문서
│   └── 📁 unused-configs/    # 미사용 설정
├── 📁 docker/                # Docker 설정
├── 📁 docs/                  # 프로젝트 문서
├── 📁 monitoring/            # 모니터링 설정
├── 📁 prisma/                # 데이터베이스 스키마
├── 📁 public/                # 정적 자산
├── 📁 scripts/               # 배포 스크립트
└── 📁 tests/                 # 테스트 파일
```

## 🚀 빠른 시작

### 1. 저장소 클론
```bash
git clone <repository-url>
cd blee-cms
```

### 2. 환경 변수 설정
```bash
cp .env.example .env
# .env 파일을 편집하여 실제 값 설정
```

### 3. 의존성 설치
```bash
npm install
```

### 4. 데이터베이스 설정
```bash
npx prisma migrate dev
npx prisma db seed
```

### 5. 개발 서버 시작
```bash
npm run dev
```

## 🐳 Docker로 실행

### 개발 환경
```bash
docker-compose up -d
```

### 프로덕션 환경
```bash
# 환경 변수 설정
cp .env.production.example .env.production

# 프로덕션 배포
./scripts/production-setup.sh
```

## 📊 모니터링 & 관리

### 시스템 상태 확인
```bash
# 헬스체크
curl http://localhost:3000/health

# 메트릭 확인
curl http://localhost:3000/api/metrics

# 프로덕션 상태
curl http://localhost:3000/api/production
```

### 모니터링 대시보드
- **Grafana**: http://localhost:3001
- **Prometheus**: http://localhost:9090
- **애플리케이션**: http://localhost:3000

## 🧪 테스트

### 단위 테스트
```bash
npm run test
```

### 통합 테스트
```bash
npm run test:integration
```

### E2E 테스트
```bash
npm run test:e2e
```

### 전체 테스트 실행
```bash
npm run test:all
```

## 📈 성능 최적화

### 번들 분석
```bash
npm run build:analyze
```

### 성능 측정
```bash
npm run test:performance
```

### 이미지 최적화
```bash
# 자동 이미지 최적화 활성화됨
# WebP/AVIF 자동 변환 지원
```

## 🔧 개발 도구

### 코드 품질 검사
```bash
npm run lint
npm run type-check
```

### 데이터베이스 관리
```bash
# 마이그레이션 생성
npx prisma migrate dev --name <migration-name>

# 스키마 적용
npx prisma db push

# 데이터베이스 시드
npx prisma db seed
```

### 캐시 관리
```bash
# Redis 캐시 초기화
npm run cache:clear

# 성능 캐시 최적화
npm run cache:optimize
```

## 🚀 배포

### 스테이징 배포
```bash
npm run deploy:staging
```

### 프로덕션 배포
```bash
npm run deploy:production
```

### 롤백
```bash
npm run rollback
```

## 📚 문서

- [개발 설정 가이드](docs/DEVELOPMENT_SETUP.md)
- [카카오 OAuth 설정](docs/kakao-oauth-setup.md)
- [네이버 OAuth 설정](docs/naver-oauth-setup.md)

## 라이선스

MIT License

## 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 문의

프로젝트 관련 문의사항은 이슈를 통해 남겨주세요.