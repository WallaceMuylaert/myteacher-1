import urllib.parse
from typing import Optional
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import or_
from sqlalchemy.orm import Session

from backend.schemas import auth as auth_schemas
from backend.schemas import users as users_schemas
from backend.crud import users as users_crud
from backend.models.users import User
from backend.core import database, security
from backend.core.config import settings
from backend.core.logger import logger

router = APIRouter()


@router.post("/register", response_model=users_schemas.User, status_code=status.HTTP_201_CREATED)
def register(payload: users_schemas.UserRegister, db: Session = Depends(database.get_db)):
    """Cadastro público: cria a conta com Nome, Sobrenome, E-mail e Senha."""
    email_clean = payload.email.strip().lower()
    
    taken = db.query(User).filter(User.email.ilike(email_clean)).first()
    if taken:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este e-mail já está em uso. Tente outro ou faça login.",
        )

    full_name = f"{payload.first_name.strip()} {payload.last_name.strip()}".strip()

    return users_crud.create_user(
        db=db,
        user=users_schemas.UserCreate(
            email=email_clean,
            password=payload.password,
            full_name=full_name,
            nickname=payload.nickname or email_clean.split("@")[0],
            is_trial=True,
            auth_provider="local",
        ),
    )


@router.post("/token", response_model=auth_schemas.Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    user = users_crud.get_user_by_nickname(db, nickname=form_data.username)
    if not user or not user.hashed_password or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = security.timedelta(minutes=security.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


def _get_frontend_url(request: Request) -> str:
    if settings.FRONTEND_URL:
        return settings.FRONTEND_URL.rstrip("/")
    origin = request.headers.get("origin") or request.headers.get("referer")
    if origin:
        return origin.rstrip("/")
    return str(request.base_url).rstrip("/")


def _get_google_callback_url(request: Request) -> str:
    if settings.GOOGLE_CALLBACK_URL:
        return settings.GOOGLE_CALLBACK_URL
    base = str(request.base_url).rstrip("/")
    return f"{base}/auth/google/callback"


@router.get("/auth/google")
@router.get("/google")
async def google_login(request: Request):
    """Inicia o fluxo OAuth com o Google."""
    frontend_url = _get_frontend_url(request)

    if not settings.GOOGLE_CLIENT_ID:
        return RedirectResponse(url=f"{frontend_url}/login?error=google_not_configured")

    callback_url = _get_google_callback_url(request)
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": callback_url,
        "response_type": "code",
        "scope": settings.GOOGLE_SCOPES,
        "access_type": "offline",
        "prompt": "consent",
    }
    google_auth_base = settings.GOOGLE_AUTH_URL.rstrip("?")
    google_auth_url = f"{google_auth_base}?{urllib.parse.urlencode(params)}"
    return RedirectResponse(url=google_auth_url)


@router.get("/auth/google/callback")
@router.get("/google/callback")
async def google_callback(
    request: Request,
    code: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    db: Session = Depends(database.get_db),
):
    """Callback do Google OAuth: troca o code por dados do usuário, cria ou localiza a conta e redireciona."""
    frontend_url = _get_frontend_url(request)

    if error or not code:
        logger.warning(f"Google OAuth error or missing code: {error}")
        return RedirectResponse(url=f"{frontend_url}/login?error=oauth_failed")

    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        logger.error("Google OAuth client credentials not set.")
        return RedirectResponse(url=f"{frontend_url}/login?error=google_not_configured")

    callback_url = _get_google_callback_url(request)

    try:
        # 1. Trocar o authorization code por tokens no Google
        token_url = settings.GOOGLE_TOKEN_URL
        token_data = {
            "code": code,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": callback_url,
            "grant_type": "authorization_code",
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            token_res = await client.post(token_url, data=token_data)
            if token_res.status_code != 200:
                logger.error(f"Google Token Exchange Error: {token_res.text}")
                return RedirectResponse(url=f"{frontend_url}/login?error=oauth_failed")
            
            tokens = token_res.json()
            access_token_google = tokens.get("access_token")
            refresh_token_google = tokens.get("refresh_token")

            # 2. Obter informações do usuário Google
            userinfo_res = await client.get(
                settings.GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token_google}"},
            )
            if userinfo_res.status_code != 200:
                logger.error(f"Google UserInfo Error: {userinfo_res.text}")
                return RedirectResponse(url=f"{frontend_url}/login?error=oauth_failed")

            google_profile = userinfo_res.json()

        email = google_profile.get("email")
        if not email:
            return RedirectResponse(url=f"{frontend_url}/login?error=oauth_failed")

        email_clean = email.strip().lower()
        google_id = google_profile.get("id")
        given_name = google_profile.get("given_name", "")
        family_name = google_profile.get("family_name", "")
        picture = google_profile.get("picture", "")
        name = google_profile.get("name") or f"{given_name} {family_name}".strip() or "Usuário Google"

        # 3. Localizar usuário existente ou criar novo
        user = users_crud.get_user_by_email(db, email=email_clean)
        is_new_user = False

        if not user:
            is_new_user = True
            user = users_crud.create_user(
                db=db,
                user=users_schemas.UserCreate(
                    email=email_clean,
                    full_name=name,
                    google_id=google_id,
                    auth_provider="google",
                    avatar=picture,
                    nickname=email_clean.split("@")[0],
                    is_trial=True,
                ),
            )
            user.google_access_token = access_token_google
            if refresh_token_google:
                user.google_refresh_token = refresh_token_google
            db.commit()
            db.refresh(user)
        else:
            # Atualizar google_id, avatar e tokens
            if not user.google_id:
                user.google_id = google_id
            if not user.avatar and picture:
                user.avatar = picture
            user.google_access_token = access_token_google
            if refresh_token_google:
                user.google_refresh_token = refresh_token_google
            db.commit()
            db.refresh(user)

        # 4. Gerar access token JWT da nossa aplicação
        access_token_expires = security.timedelta(minutes=security.ACCESS_TOKEN_EXPIRE_MINUTES)
        app_jwt = security.create_access_token(
            data={"sub": user.email}, expires_delta=access_token_expires
        )

        return RedirectResponse(
            url=f"{frontend_url}/auth/callback?token={app_jwt}&isNewUser={'true' if is_new_user else 'false'}"
        )

    except Exception as e:
        logger.error(f"Exception during Google OAuth callback: {e}", exc_info=True)
        return RedirectResponse(url=f"{frontend_url}/login?error=oauth_failed")

