#!/usr/bin/env bash
# HUB FAMILY 배포 — 한 번에 실행.
#
#   ./deploy.sh                 # 코드 받기 → 컨테이너 → 마이그레이션 → 웹앱 → 확인
#   ./deploy.sh --no-pull       # git pull 건너뛰기
#   ./deploy.sh --no-web        # 웹앱 배포 건너뛰기 (API 만 갱신)
#   ./deploy.sh --dev           # prod 오버레이 없이 (로컬용)
#
# 아파치는 건드리지 않는다. 이 서버는 사이트 100여 개가 함께 도는 공용 호스트라
# 웹서버 재시작은 사람이 확인하고 직접 한다.
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"
cd "$DEPLOY_DIR"

DO_PULL=1
DO_WEB=1
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)

for arg in "$@"; do
  case "$arg" in
    --no-pull) DO_PULL=0 ;;
    --no-web)  DO_WEB=0 ;;
    --dev)     COMPOSE=(docker compose -f docker-compose.yml) ;;
    -h|--help) sed -n '2,10p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "알 수 없는 옵션: $arg"; exit 1 ;;
  esac
done

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }
fail() { printf '\033[1;31m실패: %s\033[0m\n' "$1"; exit 1; }

[ -f .env ] || fail ".env 가 없습니다. cp .env.example .env 후 값을 채우세요."

# .env 에서 포트와 호스트를 읽는다
PORT="$(grep -E '^API_HOST_PORT=' .env | cut -d= -f2 | cut -d'#' -f1 | tr -d ' \r')"
PORT="${PORT:-8000}"
HOST="$(grep -E '^PUBLIC_BASE_URL=' .env | cut -d= -f2- | tr -d ' \r' | sed -E 's#^https?://##; s#/.*##')"

# ── 1. 코드 ────────────────────────────────────────────────────────
if [ "$DO_PULL" = 1 ]; then
  step "코드 받기"
  git -C "$REPO_DIR" pull --ff-only
fi
echo "리비전: $(git -C "$REPO_DIR" rev-parse --short HEAD)  $(git -C "$REPO_DIR" log -1 --format=%s)"

# ── 2. 컨테이너 ────────────────────────────────────────────────────
step "컨테이너 빌드 · 기동"
"${COMPOSE[@]}" up -d --build

step "기동 대기"
# docker compose ps 의 --format 옵션은 버전마다 달라 쓰지 않는다.
# 실제로 응답하는지를 기준으로 기다린다.
ready=0
for _ in $(seq 1 40); do
  if curl -sf --max-time 3 "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 3
done
"${COMPOSE[@]}" ps
[ "$ready" = 1 ] || fail "API 가 기동하지 않았습니다.  ${COMPOSE[*]} logs api"

# ── 3. 마이그레이션 ────────────────────────────────────────────────
step "DB 마이그레이션"
"${COMPOSE[@]}" exec -T api alembic upgrade head

# ── 4. 웹앱 ────────────────────────────────────────────────────────
if [ "$DO_WEB" = 1 ]; then
  step "웹앱 빌드 · 배포"
  "$DEPLOY_DIR/publish-webapp.sh"
fi

# ── 5. 확인 ────────────────────────────────────────────────────────
step "동작 확인"
health="$(curl -s --max-time 5 "http://127.0.0.1:${PORT}/health" || true)"
echo "  컨테이너 직접   : ${health:-응답 없음}"
case "$health" in
  *'"status":"ok"'*) ;;
  *) fail "API 가 응답하지 않습니다.  ${COMPOSE[*]} logs api" ;;
esac

if [ -n "$HOST" ]; then
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 -H "Host: $HOST" http://127.0.0.1/api/v1/me || true)"
  echo "  아파치 프록시   : HTTP $code  (401 이면 정상)"
  [ "$code" = "401" ] || echo "    ! 401 이 아닙니다. 404=프록시 미적용, 502/503=컨테이너 문제"

  if [ "$DO_WEB" = 1 ]; then
    wcode="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 -H "Host: $HOST" http://127.0.0.1/ || true)"
    echo "  웹앱 첫 화면    : HTTP $wcode  (200 이면 정상)"
  fi
fi

printf '\n\033[1;32m배포 완료\033[0m — http://%s/\n' "${HOST:-hubfamily.mangotree.co.kr}"
