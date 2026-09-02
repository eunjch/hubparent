"""환경변수 설정. 값은 deploy/.env 에서 온다 (.env.example 참고)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # 실행 환경
    ENV: str = "dev"
    APP_TIMEZONE: str = "Asia/Seoul"
    PUBLIC_BASE_URL: str = "http://127.0.0.1:8000"

    # 보안
    SECRET_KEY: str = "dev-only-change-me"
    ACCESS_TOKEN_MINUTES: int = 30
    # 어르신이 재로그인 화면을 보면 그 시점에 이탈한다 — 계획서 1.4
    REFRESH_TOKEN_DAYS: int = 180

    # PostgreSQL
    POSTGRES_DB: str = "hubfamily"
    POSTGRES_USER: str = "hubfamily"
    POSTGRES_PASSWORD: str = ""
    POSTGRES_HOST: str = "db"
    POSTGRES_PORT: int = 5432

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # 업로드
    UPLOAD_DIR: str = "/data/uploads"
    MAX_UPLOAD_MB: int = 8

    # 알림 임계값 — 계획서 8장
    MED_REMIND_L1_MINUTES: int = 30
    MED_REMIND_L2_MINUTES: int = 120
    NO_RESPONSE_HOURS: int = 24
    ALERT_SCAN_INTERVAL_MINUTES: int = 15
    DAILY_REPORT_HOUR: int = 21

    # 메일 — 네이버웍스 SMTP (M4 리포트 메일)
    # 네이버웍스는 인증 계정 주소로만 발신된다. From 을 사용자 주소로 바꿀 수 없다.
    SMTP_HOST: str = "smtp.worksmobile.com"
    SMTP_PORT: int = 465
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    MAIL_FROM_NAME: str = "HUB FAMILY"

    # 외부 연동 — M3 에서 채운다
    SMS_PROVIDER: str = ""
    SMS_API_KEY: str = ""
    SMS_SENDER_NUMBER: str = ""
    FCM_CREDENTIALS_PATH: str = ""
    APNS_KEY_PATH: str = ""
    APNS_KEY_ID: str = ""
    APNS_TEAM_ID: str = ""

    @property
    def is_prod(self) -> bool:
        return self.ENV == "prod"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
