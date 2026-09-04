from sqlalchemy import Boolean, Column, Integer, String, Date, DateTime
from sqlalchemy.orm import relationship
from backend.core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    is_trial = Column(Boolean, default=False)
    trial_started_at = Column(DateTime, nullable=True)
    
    # Role and Plan Logic
    role = Column(String, default="autonomous_teacher")
    school_id = Column(Integer, nullable=True)
    stripe_customer_id = Column(String, nullable=True)
    stripe_subscription_id = Column(String, nullable=True)
    plan_id = Column(String, nullable=True)
    max_classes = Column(Integer, default=10)
    
    full_name = Column(String, nullable=True)
    birth_date = Column(Date, nullable=True)
    nickname = Column(String, nullable=True)
    avatar = Column(String, nullable=True)
    google_id = Column(String, unique=True, index=True, nullable=True)
    auth_provider = Column(String, default="local")
    google_access_token = Column(String, nullable=True)
    google_refresh_token = Column(String, nullable=True)

    owned_classes = relationship("Class", back_populates="owner")
    students = relationship("Student", back_populates="owner")
    calendar_events = relationship("CalendarEvent", back_populates="user", cascade="all, delete-orphan")
