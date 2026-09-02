FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# 의존성만 먼저 설치해 레이어 캐시를 살린다.
# 이 시점엔 소스가 없으므로 패키지 디렉터리를 임시로 만들어 설치한 뒤,
# 스텁 패키지만 지운다. 의존성은 남고 실제 소스는 아래에서 복사한다.
COPY pyproject.toml ./
RUN mkdir -p app && touch app/__init__.py \
 && pip install --upgrade pip \
 && pip install . \
 && pip uninstall -y hubfamily-api \
 && rm -rf app

COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app

# 업로드 볼륨 마운트 지점
RUN mkdir -p /data/uploads

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
