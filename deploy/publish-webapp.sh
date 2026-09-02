#!/usr/bin/env bash
# 웹앱을 아파치 DocumentRoot 로 배포한다.
#
# 개발 중 브라우저에서 바로 확인하기 위한 것이다.
# 출시용 앱은 이 번들을 Capacitor 로 감싸 앱 안에 동봉한다 (계획서 3장).
#
# 서버에 Node 를 설치하지 않고 컨테이너로 빌드한다.
#   ./publish-webapp.sh                       # 같은 오리진 사용 (권장)
#   ./publish-webapp.sh https://example.com   # API 주소를 따로 지정
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOC_ROOT="${DOC_ROOT:-/home/hubfamily/www}"
API_BASE="${1:-}"

echo "==> 웹앱 빌드 (node:22-alpine)"
docker run --rm \
  -v "$REPO_DIR/webapp":/w -w /w \
  -e "VITE_API_BASE_URL=$API_BASE" \
  node:22-alpine sh -c "npm ci --no-audit --no-fund && npm run build"

echo "==> $DOC_ROOT 로 복사"
# DocumentRoot 는 홈 디렉터리가 아니라 www 하위다.
# 홈을 그대로 열면 .bashrc 같은 dotfile 이 웹에 노출된다.
mkdir -p "$DOC_ROOT"
find "$DOC_ROOT" -maxdepth 1 -mindepth 1 -exec rm -rf {} +
cp -r "$REPO_DIR/webapp/dist/." "$DOC_ROOT/"
chown -R hubfamily:hubfamily "$DOC_ROOT"

echo "==> 완료"
ls -la "$DOC_ROOT"
