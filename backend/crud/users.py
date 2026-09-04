from sqlalchemy.orm import Session
from passlib.context import CryptContext
from datetime import datetime
from backend.models.users import User
from backend.schemas.users import UserCreate, UserUpdate

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
from sqlalchemy import or_

def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email.ilike(email)).first()

def get_user_by_google_id(db: Session, google_id: str):
    return db.query(User).filter(User.google_id == google_id).first()

def get_user_by_nickname(db: Session, nickname: str):
    return db.query(User).filter(
        or_(User.email.ilike(nickname), User.nickname == nickname)
    ).first()

def get_users(db: Session, skip: int = 0, limit: int = 100, search: str = None):
    query = db.query(User)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(or_(
            User.full_name.ilike(search_filter),
            User.email.ilike(search_filter),
            User.nickname.ilike(search_filter)
        ))
    return query.offset(skip).limit(limit).all()

def create_user(db: Session, user: UserCreate):
    hashed_password = pwd_context.hash(user.password) if user.password else None
    db_user = User(
        email=user.email.strip().lower(),
        hashed_password=hashed_password,
        full_name=user.full_name,
        birth_date=user.birth_date,
        nickname=user.nickname,
        avatar=user.avatar,
        google_id=user.google_id,
        auth_provider=user.auth_provider or "local",
        is_trial=user.is_trial if user.is_trial else False,
        trial_started_at=datetime.utcnow() if user.is_trial else None
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def delete_user(db: Session, user_id: int):
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        db.delete(user)
        db.commit()
    return user

def update_user_password(db: Session, user_id: int, password: str):
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        hashed_password = pwd_context.hash(password)
        user.hashed_password = hashed_password
        db.commit()
        db.refresh(user)
    return user

def update_user(db: Session, user_id: int, user_update: UserUpdate):
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        return None
    
    update_data = user_update.dict(exclude_unset=True)
    if "password" in update_data and update_data["password"]:
        hashed_password = pwd_context.hash(update_data["password"])
        update_data["hashed_password"] = hashed_password
        del update_data["password"]
    
    # Lógica de trial: ao ativar trial, setar trial_started_at
    if "is_trial" in update_data:
        if update_data["is_trial"] and not db_user.is_trial:
            # Ativando trial -> setar data de início
            update_data["trial_started_at"] = datetime.utcnow()
        elif not update_data["is_trial"]:
            # Desativando trial -> limpar data
            update_data["trial_started_at"] = None
    
    for key, value in update_data.items():
        setattr(db_user, key, value)
    
    db.commit()
    db.refresh(db_user)
    return db_user
