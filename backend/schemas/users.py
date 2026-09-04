from pydantic import BaseModel, EmailStr, Field, computed_field, field_validator
from datetime import date, datetime
from typing import Optional
from backend.core.config import settings

class UserBase(BaseModel):
    email: str
    full_name: Optional[str] = None
    birth_date: Optional[date] = None
    nickname: Optional[str] = None
    avatar: Optional[str] = None
    google_id: Optional[str] = None
    auth_provider: Optional[str] = "local"

class UserCreate(UserBase):
    password: Optional[str] = None
    is_trial: Optional[bool] = False

class UserRegister(BaseModel):
    """Cadastro público: nome, sobrenome, email e senha."""
    first_name: str = Field(min_length=2, max_length=60)
    last_name: str = Field(min_length=2, max_length=60)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    nickname: Optional[str] = None

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()

    @field_validator("first_name", "last_name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        return " ".join(value.split())


class UserUpdate(BaseModel):
    email: Optional[str] = None
    full_name: Optional[str] = None
    birth_date: Optional[date] = None
    nickname: Optional[str] = None
    avatar: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None
    is_trial: Optional[bool] = None

class User(UserBase):
    id: int
    is_active: bool
    is_admin: bool
    is_trial: Optional[bool] = False
    trial_started_at: Optional[datetime] = None
    plan_id: Optional[str] = None
    max_classes: Optional[int] = None

    @computed_field
    @property
    def trial_days_remaining(self) -> Optional[int]:
        if not self.is_trial or not self.trial_started_at:
            return None
        elapsed = (datetime.utcnow() - self.trial_started_at).days
        remaining = settings.TRIAL_DAYS - elapsed
        return max(remaining, 0)

    @computed_field
    @property
    def trial_expired(self) -> bool:
        if not self.is_trial:
            return False
        if not self.trial_started_at:
            return False
        return (datetime.utcnow() - self.trial_started_at).days >= settings.TRIAL_DAYS

    class Config:
        from_attributes = True
