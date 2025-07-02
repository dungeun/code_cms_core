# 블리CMS 데이터베이스 설정 가이드

## 옵션 1: 로컬 PostgreSQL 사용 (권장)

### 1. PostgreSQL 설치

#### macOS (Homebrew 사용)
```bash
brew install postgresql@16
brew services start postgresql@16
```

#### Windows
[PostgreSQL 공식 다운로드 페이지](https://www.postgresql.org/download/windows/)에서 설치

#### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### 2. 데이터베이스 생성
```bash
createdb bleecms
```

또는 psql로 접속하여 생성:
```bash
psql -U postgres
CREATE DATABASE bleecms;
\q
```

### 3. 환경 변수 설정
`.env` 파일이 다음과 같이 설정되어 있는지 확인:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bleecms?schema=public"
```

### 4. 마이그레이션 실행
```bash
npx prisma migrate dev --name init
```

### 5. Seed 데이터 실행
```bash
npx prisma db seed
```

## 옵션 2: Prisma Postgres 사용

### 1. Prisma Dev 서버 시작
별도의 터미널을 열고 다음 명령을 실행하세요:
```bash
npx prisma dev
```

이 명령은 로컬 Prisma Postgres 서버를 시작합니다. 서버는 백그라운드에서 계속 실행되어야 합니다.

### 2. 마이그레이션 실행
다른 터미널에서 다음 명령을 실행하세요:
```bash
npx prisma migrate dev --name init
```

### 3. Seed 데이터 실행
```bash
npx prisma db seed
```

## SQLite 사용 (대안)

Prisma Postgres를 사용할 수 없는 경우, SQLite를 사용할 수 있습니다.

### 1. 환경 변수 수정
`.env` 파일에서:
```
# DATABASE_URL="prisma+postgres://..."
DATABASE_URL="file:./dev.db"
```

### 2. Schema 수정
`prisma/schema.prisma` 파일에서:
- provider를 "sqlite"로 변경
- PostgreSQL 특정 데이터 타입 제거 (@db.VarChar, @db.Text 등)

### 3. 마이그레이션 및 Seed 실행
```bash
npx prisma migrate dev --name init
npx prisma db seed
```

## 생성되는 초기 데이터

- **관리자 계정**: 
  - 이메일: admin@bleecms.com
  - 비밀번호: admin123!@#
  
- **메뉴(카테고리)**: 주식, 코인, 알뜰구매, 휴대폰, 부동산, 경매
- **게시글**: 각 메뉴별 10개씩 (총 60개)
- **메인페이지 블록**: 히어로, 최근게시물, 카테고리 그리드, 인기 게시물
- **사이트 설정**: 기본 설정값들

## 문제 해결

### "Can't reach database server" 오류
- Prisma Dev 서버가 실행 중인지 확인하세요
- `npx prisma dev` 명령이 별도 터미널에서 실행 중이어야 합니다

### 마이그레이션 오류
- 기존 마이그레이션 제거: `rm -rf prisma/migrations`
- 다시 시도: `npx prisma migrate dev --name init`