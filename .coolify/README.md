# 블리CMS Coolify 배포 가이드

## 개요
블리CMS Enterprise Edition을 Coolify 플랫폼에 배포하기 위한 구성 파일입니다.

## 사전 요구사항
- Coolify v4.0 이상
- PostgreSQL 15
- Redis 7 (클러스터 모드)
- 최소 2GB RAM, 2 CPU 코어
- Docker 및 Docker Compose

## 빠른 시작

### 1. Coolify에서 새 프로젝트 생성
1. Coolify 대시보드에 로그인
2. "New Resource" → "Docker Compose" 선택
3. Git 저장소 연결

### 2. 환경 변수 설정
`.env.example` 파일을 참고하여 Coolify 대시보드에서 환경 변수 설정:

```bash
# 필수 환경 변수
DATABASE_URL=postgresql://user:pass@db:5432/blee_cms
REDIS_CLUSTER_NODES=redis1:6379,redis2:6379,redis3:6379
SESSION_SECRET=your-secret-key
KAKAO_CLIENT_ID=your-kakao-id
KAKAO_CLIENT_SECRET=your-kakao-secret
NAVER_CLIENT_ID=your-naver-id
NAVER_CLIENT_SECRET=your-naver-secret
```

### 3. 배포 설정
Coolify 대시보드에서:
1. Build Pack: "Docker Compose" 선택
2. Compose File: `.coolify/docker-compose.yml` 지정
3. Base Directory: 프로젝트 루트 설정

### 4. 배포 실행
```bash
# Coolify CLI 사용
coolify deploy --project blee-cms --environment production

# 또는 웹 대시보드에서 "Deploy" 버튼 클릭
```

## 구성 파일 설명

### coolify.json
- 애플리케이션 메타데이터 및 배포 설정
- 자동 스케일링 규칙
- 헬스체크 설정
- 리소스 제한

### docker-compose.yml
- 컨테이너 구성
- 네트워크 설정
- 볼륨 마운트
- Traefik 라벨 (리버스 프록시)

### 스크립트
- `deploy.sh`: 배포 자동화 스크립트
- `rollback.sh`: 롤백 스크립트
- `backup.sh`: 백업 스크립트

## 고급 설정

### 자동 스케일링
```json
{
  "scaling": {
    "auto": true,
    "min_replicas": 2,
    "max_replicas": 10,
    "metrics": {
      "cpu_threshold": 70,
      "memory_threshold": 80,
      "requests_per_second": 1000
    }
  }
}
```

### SSL/TLS 설정
Coolify는 Let's Encrypt를 통한 자동 SSL 인증서 발급을 지원합니다:
```yaml
labels:
  traefik.http.routers.blee-cms.tls: "true"
  traefik.http.routers.blee-cms.tls.certresolver: "letsencrypt"
```

### 백업 설정
자동 백업은 매일 새벽 2시에 실행됩니다:
```json
{
  "backup": {
    "enabled": true,
    "schedule": "0 2 * * *",
    "retention": 7,
    "targets": ["database", "uploads", "plugins"]
  }
}
```

### 모니터링
Prometheus 메트릭은 포트 9090에서 사용 가능:
- CPU 사용률
- 메모리 사용량
- 요청 처리 시간
- 활성 연결 수
- 데이터베이스 쿼리 성능

## 트러블슈팅

### 헬스체크 실패
```bash
# 로그 확인
coolify logs --project blee-cms --tail 100

# 수동 헬스체크
curl https://your-domain.com/api/health
```

### 데이터베이스 연결 문제
```bash
# 데이터베이스 연결 테스트
docker exec blee-cms-app npx prisma db push --dry-run

# 마이그레이션 상태 확인
docker exec blee-cms-app npx prisma migrate status
```

### Redis 클러스터 문제
```bash
# Redis 클러스터 상태 확인
docker exec redis-node1 redis-cli cluster info
```

## 성능 최적화

### 1. 리소스 조정
```yaml
resources:
  limits:
    cpus: "4"
    memory: "4096M"
  reservations:
    cpus: "1"
    memory: "1024M"
```

### 2. 캐싱 설정
- Redis 메모리 정책: `allkeys-lru`
- 캐시 TTL: 1시간 (조정 가능)

### 3. 데이터베이스 최적화
- Connection Pooling: PgBouncer 사용
- Read Replica: 읽기 전용 쿼리 분산

## 보안 고려사항

### 1. 환경 변수
- 민감한 정보는 Coolify Secrets 사용
- `.env` 파일은 Git에 커밋하지 않음

### 2. 네트워크
- 내부 네트워크만 사용
- 외부 접근은 Traefik 프록시 통해서만

### 3. 파일 권한
- 업로드 디렉토리: 755
- 설정 파일: 644
- 실행 파일: 755

## 유지보수

### 로그 관리
```bash
# 로그 확인
coolify logs --project blee-cms

# 로그 정리
docker exec blee-cms-app sh -c 'find /app/logs -name "*.log" -mtime +7 -delete'
```

### 업데이트
```bash
# 새 버전 배포
git tag v1.0.1
git push origin v1.0.1
coolify deploy --project blee-cms --tag v1.0.1
```

### 롤백
```bash
# 이전 버전으로 롤백
coolify rollback --project blee-cms --to-version v1.0.0
```

## 지원

문제가 발생하면:
1. [Coolify 문서](https://coolify.io/docs) 확인
2. [블리CMS GitHub Issues](https://github.com/your-repo/issues) 생성
3. Coolify Discord 커뮤니티 참여

## 라이선스
MIT License