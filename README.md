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

서버에서 한 줄이면 된다. 코드 받기 → 컨테이너 빌드·기동 → 마이그레이션 → 웹앱 배포 → 동작 확인까지 한다.

```bash
cd /opt/hubfamily/deploy && ./deploy.sh
```

| 옵션 | 동작 |
|---|---|
| `--no-pull` | `git pull` 건너뛰기 |
| `--no-web` | 웹앱 배포 없이 API 만 갱신 |
| `--dev` | prod 오버레이 없이 (로컬용) |

웹앱만 다시 올릴 때는 `./publish-webapp.sh`.

**아파치는 스크립트가 건드리지 않는다.** 대상 서버는 사이트 100여 개가 함께 도는 공용 호스트라,
vhost 변경과 재시작은 사람이 확인하고 직접 한다. 재시작은 반드시 `graceful`.

```bash
/usr/local/apache/bin/httpd -t          # Syntax OK 확인
/usr/local/apache/bin/apachectl graceful
```

vhost 원본은 `deploy/apache/hubfamily.conf`, 서버 실제 경로는 `/usr/local/httpd2/conf.d/hubfamily.conf`.
상세는 계획서 10장 참고.

### 최초 1회

```bash
useradd -m -d /home/hubfamily hubfamily
mkdir -p /home/hubfamily/www /home/hubfamily/uploads
chown -R hubfamily:hubfamily /home/hubfamily
git clone https://github.com/eunjch/hubparent.git /opt/hubfamily
cd /opt/hubfamily/deploy && cp .env.example .env && chmod 600 .env
vi .env      # ENV=prod, SECRET_KEY, POSTGRES_PASSWORD, PUBLIC_BASE_URL
./deploy.sh
```

> **경로 규칙** — 웹에 열리는 건 `/home/hubfamily/www` 하나뿐이다.
> `DocumentRoot` 를 홈 디렉터리로 두면 `.bashrc` 같은 파일이 웹으로 읽힌다.
> 저장소와 `.env` 는 `/opt/hubfamily` 에 둔다.
>
> | 경로 | 용도 | 웹 노출 |
> |---|---|---|
> | `/opt/hubfamily` | 저장소 · `.env` | 없음 |
> | `/home/hubfamily/www` | 웹앱 빌드 산출물 | `/` |
> | `/home/hubfamily/uploads` | 업로드 파일 | `/uploads/` |

## 브랜치

`main`(배포) ← `develop`(통합) ← `feature/*` · `fix/*` · `chore/*`

커밋 메시지는 Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`).
