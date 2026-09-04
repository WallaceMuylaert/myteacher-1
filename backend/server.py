import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.core import database
from backend.models import users, classes, students, enrollments, attendance, payments, plans, config, calendar
from backend.core.router_loader import include_routers
from backend.core.logger import logger, log_error_with_traceback
from backend.core.config import settings

from contextlib import asynccontextmanager
from backend.core.init_db import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Inicialização do banco de dados na inicialização do app
    logger.info("API starting up...")
    try:
        logger.info("Creating database tables...")
        database.Base.metadata.create_all(bind=database.engine)
        logger.info("Tables created/verified.")
        
        print("👤 Initializing admin user...")
        db = next(database.get_db())
        try:
            init_db(db)
            logger.info("Admin user initialization finished.")
        except Exception as e:
            log_error_with_traceback("Error during init_db (non-critical)", e)
        finally:
            db.close()
    except Exception as e:
        logger.error(f"CRITICAL ERROR during startup: {e}", exc_info=True)
        # Not crashing the app here might allow it to report health as unhealthy via another way,
        # but for now we want to know what failed.
    
    yield
    logger.info("API shutting down...")

app = FastAPI(
    title="MyTeacher API",
    description="API para gerenciamento de alunos e turmas",
    version="2.0.2",
    lifespan=lifespan
)

cors_origins_env = settings.CORS_ORIGINS or os.getenv("CORS_ORIGINS", "")
if cors_origins_env:
    # Produção: usa origens específicas do .env
    origins = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]
else:
    # Desenvolvimento: permite todas as origens
    origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi import Request, status
from fastapi.responses import JSONResponse
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global exception at {request.url.path} - Traceback (tallckbak) details:", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Um erro interno ocorreu no servidor."},
    )

@app.get("/health", tags=["Health"])
def health_check():
    """Endpoint para verificação de saúde da API"""
    return {"status": "healthy", "service": "MyTeacher API"}

include_routers(app)