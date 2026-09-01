# 2026-09-01 HUB FAMILY 개발 계획서

> 가족 안심 케어 플랫폼 · 팀 MEDIC
> 문서 버전 v0.1

---

## 1. 프로젝트 개요

### 1.1 제품 정의

부모(60~80대)는 최소한의 입력만 하고, 자녀(30~50대)는 부모의 하루를 요약해서 확인하는 **비감시형 가족 안심 케어 서비스**. CCTV·위치추적이 아니라 "식사/복약/기분" 3가지 체크와 스마트폰 생활 신호만으로 안심을 전달한다.

### 1.2 사용자 구조

| 구분 | 대상 | 앱에서 하는 일 |
|---|---|---|
| 어르신(Senior) | 60~80대 부모 | 하루 3회 체크(식사·복약·기분), 일정 확인, 보호자 연락 |
| 보호자(Guardian) | 30~50대 자녀 | 리포트 열람, 병원 일정 등록, 이상 징후 알림 수신, 결제 |

- 결제자와 사용자가 분리된다 → **가입/온보딩은 자녀 주도**, 어르신은 초대코드로 합류하는 흐름이어야 한다.
- 한 가족(Family)에 어르신 1명 이상 + 보호자 N명이 속한다.

### 1.3 MVP 기능 범위 (STAGE 1)

사업계획서 STAGE 1 기준. 아래 6개 + 이상 징후 알림까지가 이번 개발 범위다.

1. 식사 체크 (아침/점심/저녁, 사진 첨부 선택)
2. 복약 알림 (시간 등록, 미체크 시 단계별 재알림)
3. 기분 체크 (아침/점심/저녁, 이모지 3단계)
4. 병원 일정 관리 (자녀 등록 → 부모 알림)
5. 자녀 리포트 (일일 요약)
6. 생활 패턴 감지 (활동·조도·충전 상태)
7. 이상 징후 알림 (장시간 미응답/미체크 시 보호자 즉시 알림)

**MVP 제외 (STAGE 2 이후)**: AI 패턴 변화 분석, AI 맞춤 리포트, AI 안부 전화, 병원·요양기관 연동, 방문 케어 매칭.

---

## 2. 기술 스택

| 레이어 | 선택 | 비고 |
|---|---|---|
| 백엔드 | **Python 3.12 + FastAPI** | STAGE 2 AI 기능까지 같은 언어로 연속. 자동 OpenAPI 문서 |
| ORM / 마이그레이션 | SQLAlchemy 2.x + Alembic | |
| DB | PostgreSQL 16 | 시계열성 생활신호 + 관계형 데이터 모두 수용 |
| 캐시 / 큐 | Redis 7 | 세션 보조, 작업 큐 |
| 스케줄러 | APScheduler (별도 worker 프로세스) | 복약 알림·리포트 생성·미응답 감지 |
| 웹앱(웹뷰 콘텐츠) | React 18 + TypeScript + Vite | 어르신/보호자 화면 공용 코드베이스 |
| 앱 셸 | **Capacitor 6** | `android/`, `ios/` 네이티브 프로젝트 분리 관리 |
| 푸시 | FCM(Android) / APNs(iOS) — Capacitor Push Notifications | |
| 웹서버 | Apache 2.4 (리버스 프록시, 443 종단) | 기존 서버 자산 활용 |
| 컨테이너 | **Docker Compose** | api / worker / db / redis |
| OS | Ubuntu Server | |
| CI | GitHub Actions | lint · test · 이미지 빌드 |

> **프론트엔드 프레임워크 메모**: React로 잡았으나 Vue 3로 바꿔도 계획서의 나머지 항목은 영향받지 않는다. 착수 전 팀 숙련도로 최종 확정할 것.

---

## 3. 시스템 아키텍처

```
 ┌────────────────┐   ┌────────────────┐
 │ 어르신 단말     │   │ 보호자 단말     │
 │ Capacitor App  │   │ Capacitor App  │
 │  └ WebView     │   │  └ WebView     │
 │  └ 센서/푸시    │   │  └ 푸시         │
 └───────┬────────┘   └───────┬────────┘
         │  HTTPS (JWT)       │
         └──────────┬─────────┘
                    ▼
        ┌───────────────────────┐
        │  Apache 2.4 (443)     │  TLS 종단, 정적 파일, ProxyPass
        └───────────┬───────────┘
                    ▼
   ┌─────────────────────────────────────┐  Docker Compose
   │  api (FastAPI/uvicorn) :8000        │
   │  worker (APScheduler)               │
   │  db (PostgreSQL) :5432              │
   │  redis :6379                        │
   └─────────────────────────────────────┘
                    │
                    ▼
            FCM / APNs (푸시 발송)
```

**설계 원칙**

- 웹앱은 **정적 번들로 빌드해 Capacitor 앱 안에 동봉**한다(원격 URL 로딩 아님). 스토어 심사 리스크와 오프라인 실패를 줄이기 위함이며, API만 서버를 호출한다.
- 어르신 앱과 보호자 앱은 **같은 번들 하나**를 쓰고, 로그인 후 `role`에 따라 라우팅한다. 초기 개발 속도를 위해서이며, 두 역할의 화면 수가 늘어나면 번들 분리를 검토한다.
- 어르신 단말의 체크 입력은 **오프라인 큐잉** 후 재접속 시 동기화한다(고령층 통신 환경 대비).

---

## 4. 저장소 구조 및 Git 전략

### 4.1 디렉터리 구조 (모노레포)

```
hubfamily/
├─ docs/                       # 기획 문서, 계획서, ERD
│  ├─ PROJECT_PLAN.md
│  ├─ HUB_FAMIL.pptx
│  └─ 앱구성_MEDIC.pdf
├─ backend/
│  ├─ app/
│  │  ├─ main.py
│  │  ├─ core/                 # config, security, deps
│  │  ├─ models/               # SQLAlchemy 모델
│  │  ├─ schemas/              # Pydantic 스키마
│  │  ├─ api/v1/               # 라우터
│  │  ├─ services/             # alert_engine, report, push
│  │  └─ workers/              # 스케줄 잡
│  ├─ alembic/
│  ├─ tests/
│  ├─ pyproject.toml
│  └─ Dockerfile
├─ webapp/                     # 웹뷰에 로드되는 SPA
│  ├─ src/
│  │  ├─ senior/               # 화면 1~5, 9, 10
│  │  ├─ guardian/             # 화면 7, 8
│  │  ├─ shared/               # API 클라이언트, 오프라인 큐, 디자인 토큰
│  │  └─ native/               # Capacitor 브릿지 래퍼
│  └─ vite.config.ts
├─ mobile/                     # Capacitor 프로젝트
│  ├─ capacitor.config.ts
│  ├─ android/
│  └─ ios/
├─ deploy/
│  ├─ docker-compose.yml
│  ├─ docker-compose.prod.yml
│  ├─ apache/hubfamily.conf
│  └─ .env.example
└─ .github/workflows/ci.yml
```

### 4.2 Git 설정

- **브랜치**: `main`(배포) ← `develop`(통합) ← `feature/*`, `fix/*`, `chore/*`
- **커밋 규칙**: Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`)
- **PR**: `develop` 대상 PR 필수, CI 통과 조건. 리뷰어 1인 이상.
- **태그**: `v0.1.0` 형태 SemVer. `main` 머지 시점에 태깅.
- **.gitignore 필수 항목**: `.env`, `*.keystore`, `google-services.json`, `GoogleService-Info.plist`, `ios/App/Pods/`, `android/local.properties`, `node_modules/`, `__pycache__/`, `.venv/`
- **비밀정보**: 저장소에 절대 커밋하지 않는다. 서버는 `.env`(권한 600), CI는 GitHub Secrets 사용.
- **대용량 파일**: `docs/`의 pptx/pdf는 Git LFS 적용 검토 (현재 pptx 10MB).

### 4.3 착수 시 첫 커밋 순서

1. `git init` + `.gitignore` + `README.md` + `docs/` 이관
2. `backend/` 스캐폴딩 (FastAPI hello + Dockerfile)
3. `deploy/docker-compose.yml` (api/db/redis) — 로컬 기동 확인
4. `webapp/` 스캐폴딩 (Vite + TS)
5. `mobile/` Capacitor 초기화 + `android/` 생성
6. GitHub 원격 연결, `develop` 브랜치 생성, CI 워크플로 추가

---

## 5. 데이터 모델

### 5.1 핵심 테이블

| 테이블 | 주요 컬럼 | 설명 |
|---|---|---|
| `users` | id, phone, name, role(senior/guardian), birth_year, created_at | 계정 |
| `families` | id, name, created_by, created_at | 가족 그룹 |
| `family_members` | family_id, user_id, role, relation(아들/딸 등) | 가족-사용자 N:M |
| `invitations` | code, family_id, target_role, expires_at, used_at | 초대코드 |
| `devices` | user_id, platform, push_token, app_version, last_seen_at | 단말·푸시 토큰 |
| `meal_checks` | user_id, check_date, slot(B/L/D), status(ate/skip), photo_url, checked_at | 식사 체크 |
| `medications` | id, user_id, name, dose, times[], weekdays, start_date, end_date, active | 복약 스케줄 |
| `medication_logs` | medication_id, scheduled_at, status(taken/missed/pending), responded_at, reminder_level | 복약 이력 |
| `mood_checks` | user_id, check_date, slot, mood(good/normal/bad), checked_at | 기분 체크 |
| `schedules` | id, family_id, target_user_id, title, kind(hospital/etc), start_at, place, created_by | 일정 |
| `activity_signals` | user_id, recorded_at, screen_on_count, step_count, light_level, battery, is_charging | 생활 신호 |
| `daily_reports` | user_id, report_date, meal_done, med_status, mood, activity_level, summary_text | 일일 리포트 |
| `alerts` | id, family_id, target_user_id, type, severity, occurred_at, ack_by, ack_at | 이상 징후 |
| `emergency_contacts` | user_id, name, phone, relation, sort_order | 보호자 연락처 |
| `user_settings` | user_id, font_scale, voice_guide, notify_prefs(jsonb) | 설정 |
| `subscriptions` | family_id, plan, status, trial_ends_at, next_billing_at | 구독 |
| `audit_logs` | actor_id, action, target_type, target_id, at, ip | 민감정보 접근 감사 |

### 5.2 설계 메모

- 체크류 3종은 `(user_id, check_date, slot)` **유니크 제약** — 중복 입력 방지 및 멱등 처리.
- `activity_signals`는 증가 속도가 가장 빠르다. 월별 파티셔닝 또는 90일 보관 후 일 단위 집계로 롤업하고 원본 삭제.
- `photo_url`은 DB에 경로만, 실제 파일은 서버 볼륨(`/var/hubfamily/uploads`) 저장. MVP는 로컬 볼륨, 확장 시 S3 호환 스토리지.
- 시간 저장은 전부 UTC, 표시는 KST 변환. 복약 알림 계산은 사용자 타임존 기준.

---

## 6. API 설계 (`/api/v1`)

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/auth/otp/request` | 휴대폰 인증번호 요청 |
| POST | `/auth/otp/verify` | 인증 후 JWT 발급 |
| POST | `/auth/refresh` | 토큰 갱신 |
| GET | `/me` | 내 프로필·역할·가족 |
| POST | `/families` | 가족 생성(자녀) |
| POST | `/families/{id}/invitations` | 초대코드 발급 |
| POST | `/invitations/{code}/accept` | 어르신 합류 |
| POST | `/devices` | 푸시 토큰 등록/갱신 |
| GET/POST | `/checks/meals` | 식사 체크 조회/등록 |
| POST | `/checks/meals/{id}/photo` | 식사 사진 업로드 |
| GET/POST | `/checks/moods` | 기분 체크 |
| GET/POST/PATCH/DELETE | `/medications` | 복약 스케줄 CRUD |
| GET | `/medications/next` | 다음 복약 시간(화면 3) |
| POST | `/medications/{id}/logs` | 복용/미복용 응답 |
| GET/POST/PATCH/DELETE | `/schedules` | 일정 CRUD |
| POST | `/signals` | 생활 신호 배치 업로드 |
| POST | `/heartbeat` | 앱 생존 신호 |
| GET | `/reports/daily?date=` | 오늘 리포트(화면 6) |
| GET | `/reports/family/{user_id}?date=` | 자녀용 부모 리포트(화면 7) |
| GET | `/alerts` | 알림 목록(화면 8) |
| POST | `/alerts/{id}/ack` | 알림 확인 처리 |
| GET/POST/PATCH/DELETE | `/contacts` | 보호자 연락처(화면 10) |
| GET/PATCH | `/settings` | 설정(화면 9) |

**공통 규약**

- 인증: `Authorization: Bearer <access token>` (access 30분 / refresh 30일)
- 권한: 보호자는 **같은 family에 속한 어르신 데이터만** 조회 가능. 모든 조회 라우터에 family 소속 검증 의존성 적용.
- 체크 등록 API는 `Idempotency-Key` 헤더 지원 — 오프라인 큐 재전송 시 중복 방지.
- 에러 포맷 통일: `{ "code": "MEAL_ALREADY_CHECKED", "message": "..." }`

---

## 7. 화면 명세 (앱구성_MEDIC.pdf 매핑)

| # | 화면 | 대상 | 사용 API | 구현 메모 |
|---|---|---|---|---|
| 1 | 홈 | 어르신 | `/me`, 날씨, 각 체크 상태 | 큰 카드 4개(식사·복약·기분·일정) + 오늘 리포트 버튼. 미완료 카드 강조 |
| 2 | 식사 체크 | 어르신 | `/checks/meals` | 아침/점심/저녁 × 먹었어요/안 먹었어요. 사진 등록은 선택 |
| 3 | 약 복용 알림 | 어르신 | `/medications/next`, `/medications/{id}/logs` | 다음 복약 시간 크게 표시, 복용했어요/아직 안했어요 2버튼 |
| 4 | 기분 체크 | 어르신 | `/checks/moods` | 3시점 × 이모지 3단계, 저장하기 |
| 5 | 일정 확인 | 어르신 | `/schedules` | 병원 일정 / 기타 일정 분리. 일정 추가 가능 |
| 6 | 오늘 리포트 | 어르신 | `/reports/daily` | 식사·약·기분·활동 4항목 요약 + 격려 문구 |
| 7 | 엄마 리포트 | 보호자 | `/reports/family/{id}` | 부모 프로필 + 4항목 상태 + 상세 보기 |
| 8 | 이상 징후 알림 | 보호자 | `/alerts`, `/alerts/{id}/ack` | 경고 카드 + [확인] / [전화하기] |
| 9 | 설정 | 어르신 | `/settings` | 알림 설정, 글자 크기, 음성 안내, FAQ, 앱 정보 |
| 10 | 보호자 연락처 | 어르신 | `/contacts` | 이름·번호 카드 + 통화 버튼(`tel:`) |

---

## 8. 핵심 로직 설계

### 8.1 복약 알림 단계별 에스컬레이션

사업계획서의 "미체크 시 단계별 알림"을 아래 규칙으로 구체화한다. 값은 설정에서 조정 가능하게 둔다.

| 단계 | 시점 | 동작 |
|---|---|---|
| L0 | 예정 시각 | 어르신 푸시 "약 드실 시간이에요" |
| L1 | +30분 미응답 | 어르신 재알림 (소리·진동 강화) |
| L2 | +2시간 미응답 | 어르신 3차 알림 + 보호자 앱에 `missed_med` 표시(푸시 없음) |
| L3 | 당일 미응답 마감 | `medication_logs.status = missed` 확정, 일일 리포트 반영 |

### 8.2 이상 징후 감지 (MVP 룰 기반)

와이어프레임 8번의 "24시간 동안 응답이 없어요"를 기준으로 삼는다.

- **생존 신호 정의**: 앱 실행 / 체크 입력 / `POST /heartbeat` / 화면 켜짐 신호 중 하나라도 수신 → `devices.last_seen_at` 갱신
- **판정**: worker가 15분 주기로 스캔
  - `last_seen_at` 기준 **24시간 초과** → `alerts(type=no_response, severity=high)` 생성 + 보호자 전원 푸시
  - 하루 체크 3종 **전부 미입력** + 활동 신호 없음 → `severity=medium`
- **중복 방지**: 동일 유형 알림은 확인(ack) 전까지 재생성하지 않는다.
- **오탐 대비**: 휴대폰 방전·기기 미소지가 원인일 수 있으므로 알림 문구에 "참고용 정보"임을 명시한다(SWOT WT 전략).

### 8.3 생활 패턴 감지

- 수집 항목: 화면 켜짐 횟수, 걸음 수, 조도, 배터리·충전 상태
- 수집 주기: 30분 간격 로컬 적재 → **6시간마다 배치 업로드** (배터리 보호)
- 안드로이드 백그라운드 제약(Doze) 대응: `WorkManager` 기반 주기 작업 + 배터리 최적화 예외 요청 안내
- iOS는 `BGAppRefreshTask` 특성상 주기 보장이 약하다 → **하트비트 신뢰도는 안드로이드 우선**, iOS는 포그라운드 진입 시 동기화로 보완
- MVP에서는 **수집·저장·활동량 3단계 표시까지만**. 패턴 변화 분석은 STAGE 2.

### 8.4 일일 리포트 생성

- 매일 21:00 KST worker가 어르신별 집계 → `daily_reports` 저장
- 항목: 식사 n/3, 복약 정상/누락, 기분 최빈값, 활동 수준(상/중/하)
- 보호자에게 요약 푸시 1건 발송

---

## 9. 고령자 친화 UX 요구사항 (개발 규칙)

사업계획서 차별화 요소 및 WO 전략을 개발 기준으로 고정한다.

- 본문 최소 **18sp**, 주요 숫자·버튼 텍스트 **24sp 이상**. 설정에서 100/125/150% 배율 지원
- 터치 타깃 최소 **56×56dp**, 버튼 간 간격 12dp 이상
- 화면당 주요 행동 **1~2개**. 어르신 화면에는 스크롤 없이 보이는 범위에 핵심 버튼 배치
- 색상 대비 **WCAG AA(4.5:1) 이상**. 상태 구분을 색상에만 의존하지 않음(아이콘·텍스트 병행)
- 확인 절차 최소화 — 체크는 1탭 완료, 실수 시 되돌리기 제공
- 음성 안내: 화면 진입 시 핵심 문장 TTS 재생(설정에서 on/off)
- 전화 걸기는 `tel:` 인텐트 직결, 중간 단계 없음
- 용어: 전문 용어·영문 금지 ("싱크", "로그인 세션 만료" → "다시 시작해 주세요")

---

## 10. 인프라 및 배포

### 10.1 Docker Compose 구성

```yaml
services:
  api:      # FastAPI + uvicorn, 127.0.0.1:8000 바인딩
  worker:   # APScheduler (알림·리포트·이상감지)
  db:       # PostgreSQL 16, 볼륨 pgdata
  redis:    # Redis 7
```

- `api`, `redis`, `db` 포트는 **호스트 외부에 노출하지 않는다** (`127.0.0.1` 바인딩).
- 업로드 파일은 호스트 볼륨 `/home/hubfamily/uploads` 마운트.
- 로컬 개발은 `docker-compose.yml`, 서버는 `docker-compose.prod.yml` 오버레이.
- **호스트에 이미 Redis(`127.0.0.1:6379`)가 떠 있다.** 다른 서비스 데이터와 섞지 않기 위해 우리는 컨테이너 내부 Redis를 쓰고 호스트 포트를 열지 않는다. 충돌 없음.
- 호스트 8080은 Java 앱이 점유 중. 5432·8000은 비어 있어 그대로 사용.

### 10.2 대상 서버 실측 (2026-09-01 확인)

| 항목 | 값 |
|---|---|
| 호스트 | `211.43.214.221` (www) |
| OS | Ubuntu 18.04.6 LTS bionic — **표준 지원 종료(EOL)** |
| Docker / Compose | 24.0.2 / v2.18.1 — 설치됨 |
| **실제 웹서버** | **`/usr/local/apache` 소스 설치본** (프로세스명 `httpd`) |
| vhost 위치 | `/usr/local/apache/conf.d/*.conf` — 사이트당 1파일 |
| 미사용 | `/etc/apache2` (우분투 패키지 2.4.29)는 구동 중이 아님. **여기 설정을 넣으면 반영되지 않는다** |
| 기존 운영 | 사이트 100개 이상 공용 호스팅. `mod_cband` 사용 중 |
| 기존 규약 | 사이트별 시스템 유저 생성 → `DocumentRoot /home/<user>/www` → `<user>.conf` 작성 |

### 10.3 Apache 연결 (기존 규약 준수)

HUB FAMILY도 동일하게 `hubfamily` 유저를 만들고 `/usr/local/apache/conf.d/hubfamily.conf`를 추가한다.

```apache
<VirtualHost *:80>
    ServerAdmin webmaster@mangotree.co.kr
    DocumentRoot /home/hubfamily/www
    ServerName hubfamily.mangotree.co.kr
    CustomLog logs/hubfamily-access_log common
    Redirect permanent / https://hubfamily.mangotree.co.kr/
</VirtualHost>

<VirtualHost *:443>
    ServerAdmin webmaster@mangotree.co.kr
    DocumentRoot /home/hubfamily/www
    ServerName hubfamily.mangotree.co.kr

    SSLEngine on
    SSLCertificateFile    /경로/fullchain.pem
    SSLCertificateKeyFile /경로/privkey.pem

    ProxyPreserveHost On
    ProxyPass        /api/  http://127.0.0.1:8000/api/
    ProxyPassReverse /api/  http://127.0.0.1:8000/api/

    Alias /uploads/ /home/hubfamily/uploads/
    <Directory /home/hubfamily/uploads>
        Require all granted
        Options -Indexes
    </Directory>

    Header always set Strict-Transport-Security "max-age=31536000"

    CustomLog logs/hubfamily-ssl_access_log common
    CBandLimit 10000M
    CBandPeriod 1D
</VirtualHost>
```

- `DocumentRoot`는 비워두지 않는다 — **개인정보처리방침 페이지**를 여기서 서비스한다(스토어 심사 필수 URL).
- 웹앱 본체는 앱에 번들로 동봉되므로 이 경로로 서비스하지 않는다.
- **선결 조건**: 소스 설치 아파치에 `proxy_module`·`proxy_http_module`이 빌드돼 있어야 한다. `httpd -M`으로 확인하고, 없으면 모듈 추가 후 진행.
- 배포 전 `httpd -t`로 문법 검사 → `graceful` 재시작. 기존 100여 개 사이트가 함께 도는 서버이므로 `restart`가 아닌 `graceful`을 쓴다.

### 10.4 배포 절차

1. GitHub Actions가 `main` 태그 push 시 이미지 빌드 → GHCR 푸시
2. 서버에서 `docker compose pull && docker compose up -d`
3. 마이그레이션은 배포 직후 `docker compose run --rm api alembic upgrade head`
4. 롤백은 이전 이미지 태그로 재기동

### 10.5 운영

- 로그: 컨테이너 로그 → journald, 30일 보관
- 백업: `pg_dump` 일 1회 + 업로드 디렉터리 주간 백업, 외부 저장소 보관
- 모니터링: `/health` 엔드포인트 + uptime 체크. MVP는 외부 무료 모니터링으로 충분
- 스테이징: 동일 compose를 다른 서브도메인·DB로 1벌 더 (테스트용)

---

## 11. 보안 및 개인정보

이 서비스는 **건강 정보를 다루므로 개인정보보호법상 민감정보에 해당**한다. 초기부터 반영해야 나중에 되돌리는 비용이 없다.

- 수집 항목 최소화 원칙 명문화. 위치정보·통화내역·연락처 전체 접근은 **수집하지 않는다**(차별화 요소인 "사생활 보호"와 직결).
- 가입 시 **민감정보 수집·이용 별도 동의**, 자녀-부모 간 **정보 공유 동의**를 어르신 본인에게 별도로 받는다.
- 전송 구간 TLS 1.2+ 강제. 저장 시 휴대폰번호·주민정보성 항목 암호화.
- 보호자의 어르신 데이터 조회는 `audit_logs`에 기록.
- 앱 측: 토큰은 Capacitor Secure Storage(안드로이드 Keystore / iOS Keychain) 보관, `localStorage` 금지.
- 파기 정책: 탈퇴 시 30일 내 파기, `activity_signals` 원본 90일 보관 후 집계 롤업.
- 스토어 심사 대비: 개인정보처리방침 웹페이지, 안드로이드 데이터 세이프티 / iOS Privacy Manifest 작성.
- 알림·리포트에는 **"의료적 진단이 아닌 참고용 정보"** 고지를 상시 노출한다(의료기기 규제 회피 및 WT 전략).

---

## 12. 개발 일정 (16주)

기준일 2026-09-01(월) 착수 가정.

| 단계 | 기간 | 산출물 |
|---|---|---|
| **M0. 준비** | 9/1~9/12 (2주) | Git 저장소·CI, Docker 로컬 환경, DB 스키마 확정, API 명세 초안, 디자인 토큰·컴포넌트 |
| **M1. 인증·가족** | 9/15~9/26 (2주) | 휴대폰 인증, JWT, 가족 생성·초대코드 합류, 역할 라우팅 |
| **M2. 체크 3종** | 9/29~10/17 (3주) | 식사·복약·기분 체크 화면(1~4), 오프라인 큐, 사진 업로드 |
| **M3. 알림·일정** | 10/20~11/7 (3주) | FCM/APNs 연동, 복약 에스컬레이션, 일정 CRUD(화면 5), worker 스케줄러 |
| **M4. 리포트·이상징후** | 11/10~11/28 (3주) | 일일 리포트 생성, 화면 6·7·8, 이상 징후 룰 엔진 |
| **M5. 생활 패턴·설정** | 12/1~12/12 (2주) | 센서 수집·배치 업로드, 하트비트, 화면 9·10, 음성 안내 |
| **M6. 안정화·배포** | 12/15~12/26 (2주) | 서버 배포, QA, 고령자 사용성 테스트, 스토어 제출 |

**릴리스 목표**: 2026년 12월 말 안드로이드 내부 테스트 배포, iOS는 M6 이후 착수.

**병렬 진행 권장**: 개인정보처리방침·스토어 계정 준비는 M3 시점에 시작해야 M6에서 막히지 않는다.

---

## 13. 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 안드로이드 Doze로 백그라운드 수집 중단 | 생활 패턴·하트비트 신뢰도 저하 | WorkManager 사용, 배터리 최적화 예외 안내, 하트비트 실패를 이상징후로 오판하지 않도록 임계값 여유 |
| iOS 백그라운드 실행 제약 | 미응답 감지 정확도 낮음 | 안드로이드 우선 출시, iOS는 포그라운드 동기화 + 푸시 응답 기반 보완 |
| 어르신이 앱을 아예 안 여는 문제 | 서비스 근간 붕괴 | 알림 문구·시간 튜닝, 위젯/큰 아이콘, 자녀가 원격으로 알림 시간 조정 가능하게 |
| 이상 징후 오탐(방전·외출) | 자녀 신뢰 하락 | "참고용" 고지, 2단계 확인(재알림 후 알림), 어르신이 "괜찮아요" 1탭 응답 제공 |
| 민감정보 규제 대응 미흡 | 출시 지연·법적 리스크 | 별도 동의·감사로그·최소수집을 M1부터 구현 |
| **EOL OS + 100여 사이트 공용 호스트에 건강정보 DB 배치** | 타 사이트 침해 시 민감정보 동반 유출, 보안 패치 미수신 | ① 전용 서버 분리(권장) ② 차선: Ubuntu Pro(ESM) 적용 + DB 볼륨 암호화 + 전용 시스템 유저 격리. 착수 전 결정 필요 |
| 스토어 심사 반려(단순 웹뷰 판정) | 출시 지연 | 번들 동봉 방식 + 네이티브 기능(푸시·센서·카메라) 실사용으로 대응 |
| 구독 결제 도입 | MVP 범위 확대 | MVP는 15일 무료체험 기간만 관리, 실결제는 별도 마일스톤 |

---

## 14. 착수 직후 결정 대기 항목

1. 프론트엔드 프레임워크 최종 확정 (React vs Vue)
2. 휴대폰 인증 SMS 공급사 선정 (NHN Cloud / 알리고 / Firebase Auth)
3. 서버 도메인 및 인증서 발급 대상 확정
4. iOS 개발자 계정(연 $99) 등록 시점
5. 디자인 산출물 수급 — 와이어프레임 10종 외 실제 디자인 시안 필요 여부
