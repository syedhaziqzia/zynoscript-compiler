"""Activity log for the Activity page."""
from fastapi import APIRouter, Depends

from .. import logs
from ..auth import current_user

router = APIRouter(prefix="/api/logs", tags=["logs"])


@router.get("")
@router.get("/")
def list_logs(limit: int = 200, action: str = "", username: str = "", status: str = "", user: dict = Depends(current_user)):
    return {
        "scope": "everyone" if user["role"] == "admin" else "you",
        "logs": logs.fetch(user, limit=limit, action=action, username=username, status=status)
    }

