import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Aplicação / Segurança
    PROJECT_NAME: str = "MyTeacherApp"
    SECRET_KEY: str = "change-me-in-production-please-use-a-strong-random-value"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120
    TRIAL_DAYS: int = 14

    # URLs e Portas
    FRONTEND_URL: Optional[str] = None
    PORT_BACKEND: Optional[int] = 8501
    PORT_FRONTEND: Optional[int] = 5273
    HOST_IP: Optional[str] = "0.0.0.0"
    CORS_ORIGINS: Optional[str] = None

    # Google OAuth e Google Agenda (Calendar)
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GOOGLE_CALLBACK_URL: Optional[str] = None
    GOOGLE_AUTH_URL: str = "https://accounts.google.com/o/oauth2/v2/auth"
    GOOGLE_TOKEN_URL: str = "https://oauth2.googleapis.com/token"
    GOOGLE_USERINFO_URL: str = "https://www.googleapis.com/oauth2/v2/userinfo"
    GOOGLE_CALENDAR_API_URL: str = "https://www.googleapis.com/calendar/v3/calendars/primary/events"
    GOOGLE_SCOPES: str = "openid email profile https://www.googleapis.com/auth/calendar.events"
    GOOGLE_CALENDAR_TIMEZONE: str = "America/Sao_Paulo"

    # Stripe
    STRIPE_SECRET_KEY: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None
    STRIPE_PRICE_ID: Optional[str] = None
    STRIPE_PRICE_ESSENCIAL: Optional[str] = None
    STRIPE_PRICE_PROFISSIONAL: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
