import sys
import os
import uvicorn

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.core.config import settings

if __name__ == "__main__":
    uvicorn.run(
        "backend.server:app",
        host=settings.HOST_IP or os.getenv("HOST_IP", "0.0.0.0"),
        port=int(settings.PORT_BACKEND or os.getenv("PORT_BACKEND", 8501)),
        reload=True
    )
