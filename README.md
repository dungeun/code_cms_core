# Blee CMS - 현대적인 콘텐츠 관리 시스템

Blee CMS는 Remix 프레임워크 기반의 강력하고 유연한 콘텐츠 관리 시스템입니다.

## 주요 기능

### 사용자 관리
- 회원가입/로그인/로그아웃
- 비밀번호 찾기
- 역할 기반 권한 관리 (관리자/일반 사용자)

### 콘텐츠 관리
- 카테고리별 게시글 관리
- 리치 텍스트 에디터
- 게시글 조회수 및 좋아요 기능
- 반응형 디자인 (PC/모바일)

### 관리자 기능
- 대시보드 (통계 및 최근 활동)
- 사용자 관리
- 메뉴/카테고리 관리
- 게시글 관리
- 사이트 설정
- 테마 커스터마이징

### 테마 시스템
- 사전 설정 테마 (월급루팡, 모던, 네이처, 로즈)
- 커스텀 테마 생성 및 저장
- AI 색상 팔레트 생성
- 커스텀 폰트 관리 (눈누 폰트 지원)
- 실시간 미리보기

### 페이지 빌더
- 드래그 앤 드롭 인터페이스
- 다양한 블록 타입
  - Hero 블록
  - 최근 게시글
  - 인기 게시글
  - 카테고리 그리드
  - 배너

### 플러그인 시스템
- 확장 가능한 아키텍처
- Hook 시스템
- 플러그인 매니저

## 기술 스택

- **프레임워크**: Remix
- **데이터베이스**: PostgreSQL + Prisma ORM
- **스타일링**: TailwindCSS
- **언어**: TypeScript
- **UI 컴포넌트**: shadcn/ui

## 설치 방법

### 필수 요구사항
- Node.js 18.0.0 이상
- PostgreSQL 데이터베이스

### 설치 단계

1. 저장소 클론
```bash
git clone https://github.com/dungeun/CMS.git
cd CMS
```

2. 의존성 설치
```bash
npm install
```

3. 환경변수 설정
```bash
cp .env.example .env
```

`.env` 파일을 열어 데이터베이스 연결 정보를 설정하세요:
```
DATABASE_URL="postgresql://username:password@localhost:5432/blee_cms"
SESSION_SECRET="your-session-secret"
```

4. 데이터베이스 마이그레이션
```bash
npx prisma migrate dev
```

5. 초기 데이터 생성 (선택사항)
```bash
npx prisma db seed
```

6. 개발 서버 실행
```bash
npm run dev
```

브라우저에서 http://localhost:3000 으로 접속하세요.

## 기본 계정

Seed 데이터를 실행한 경우:
- 관리자: admin@example.com / password123
- 사용자: user@example.com / password123

## 프로젝트 구조

```
blee-cms/
├── app/
│   ├── components/     # React 컴포넌트
│   ├── routes/         # Remix 라우트
│   ├── lib/           # 서버 유틸리티
│   ├── hooks/         # React 훅
│   ├── utils/         # 클라이언트 유틸리티
│   ├── stores/        # 상태 관리
│   ├── core/          # 코어 시스템
│   └── plugins/       # 플러그인
├── prisma/            # 데이터베이스 스키마
├── public/            # 정적 파일
└── package.json
```

## 배포

### Vercel 배포
```bash
npm run build
vercel deploy
```

### Docker 배포
```bash
docker build -t blee-cms .
docker run -p 3000:3000 blee-cms
```

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