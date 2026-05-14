from fastapi import APIRouter

from app.api.v1.endpoints import alerts, auth, chat, checklist, evidence


api_router = APIRouter()
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(alerts.router, prefix="/alerts", tags=["alerts"])
api_router.include_router(checklist.router, prefix="/checklist", tags=["checklist"])
api_router.include_router(evidence.router, prefix="/evidence", tags=["evidence"])
