# HUB FAMILY

가족 안심 케어 플랫폼. 부모(60~80대)는 최소한의 입력만 하고, 자녀(30~50대)는 부모의 하루를 요약해서 확인한다.

개발 계획서: [docs/2026-09-01_HUB_FAMILY_개발계획서.md](docs/2026-09-01_HUB_FAMILY_개발계획서.md)

## 구성

| 디렉터리 | 내용 |
|---|---|
| `backend/` | FastAPI + PostgreSQL API 서버 |
| `webapp/` | 웹뷰에 로드되는 SPA (React + TypeScript) |
| `mobile/` | Capacitor 앱 셸 (`android/`, `ios/`) |
| `deploy/` | Docker Compose, Apache vhost |
| `docs/` | 기획 문서 |

## 로컬 실행

```bash
cd deploy
cp .env.example .env      # 값 채우기
docker compose up -d --build
docker compose exec api alembic upgrade head
```

- API — http://127.0.0.1:8000
- API 문서 — http://127.0.0.1:8000/docs
- 헬스체크 — http://127.0.0.1:8000/health

## 배포

대상 서버는 기존 사이트가 함께 도는 공용 호스트다. 아파치는 `/usr/local/httpd2/conf.d/hubfamily.conf`로 붙이고,
재시작은 반드시 `graceful`을 쓴다. 상세는 계획서 10장 참고.

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose exec api alembic upgrade head
```

## 브랜치

`main`(배포) ← `develop`(통합) ← `feature/*` · `fix/*` · `chore/*`

커밋 메시지는 Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`).
