# 개발 환경 설정 가이드

## 프로덕션 데이터베이스 연결

로컬 개발 환경에서 프로덕션 데이터베이스를 사용하기 위한 설정 방법입니다.

### 전제 조건

1. **SSH 접근 권한**: Coolify 서버에 SSH로 접근할 수 있어야 합니다
2. **필수 도구**: `netcat` (연결 테스트용)

### 1단계: SSH 설정

```bash
# SSH 키 생성 (없는 경우)
ssh-keygen -t rsa -b 4096 -C "your-email@example.com"

# Coolify 서버에 공개 키 추가
ssh-copy-id root@YOUR_COOLIFY_SERVER_IP
```

### 2단계: 터널 스크립트 설정

`scripts/connect-prod-db.sh` 파일을 편집하여 서버 정보를 입력하세요:

```bash
# 이 부분을 실제 값으로 변경
COOLIFY_SERVER="YOUR_COOLIFY_SERVER_IP"  # 실제 서버 IP
SSH_USER="root"                          # SSH 사용자명
SSH_KEY="~/.ssh/id_rsa"                 # SSH 개인 키 경로
```

### 3단계: 개발 환경 시작

#### 방법 1: 자동 스크립트 사용

```bash
./scripts/dev-start.sh
```

#### 방법 2: 수동 설정

1. **터미널 1**: SSH 터널 연결
```bash
./scripts/connect-prod-db.sh
```

2. **터미널 2**: 개발 서버 시작
```bash
cp .env.local .env
npm run dev
```

### 4단계: 연결 확인

개발 서버가 시작되면 다음을 확인하세요:

- PostgreSQL: `localhost:5432` 접근 가능
- Redis: `localhost:6379` 접근 가능
- Prisma 마이그레이션 실행됨

### 종료

```bash
./scripts/disconnect-prod-db.sh
```

## 문제 해결

### SSH 연결 실패
- 서버 IP와 SSH 키 경로 확인
- 방화벽 설정 확인 (포트 22 열려있는지)
- SSH 에이전트 실행: `ssh-add ~/.ssh/id_rsa`

### 데이터베이스 연결 실패
- SSH 터널이 정상 작동하는지 확인
- 내부 호스트명이 정확한지 확인
- 네트워크 연결 상태 확인

### 포트 충돌
- 로컬에서 PostgreSQL/Redis가 실행 중이면 중지
- 또는 다른 포트 사용하도록 스크립트 수정

## 보안 주의사항

- SSH 키는 안전하게 보관하세요
- `.env` 파일을 git에 커밋하지 마세요
- 프로덕션 데이터 수정 시 각별히 주의하세요

## 대안 방법

SSH 터널이 어려운 경우, 다음 대안을 고려할 수 있습니다:

1. **VPN 연결**: Coolify 서버와 같은 네트워크에 VPN으로 접근
2. **포트 포워딩**: 라우터에서 포트 포워딩 설정
3. **로컬 개발용 DB**: 별도의 로컬 데이터베이스 사용 (권장하지 않음)