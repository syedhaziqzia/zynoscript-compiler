"""One endpoint per compiler stage. Each call runs that stage (and the stages it needs) on the posted source."""
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel

from .. import logs, pipeline, ratelimit
from ..auth import current_user
from ..config import COMPILE_MAX_PER_MINUTE, MAX_SOURCE_CHARS
from .grammar import load_for

router = APIRouter(prefix="/api/compile", tags=["compiler"])


class Program(BaseModel):
    source: str


@router.post("/{stage}")
def compile_program(stage: str, body: Program, background_tasks: BackgroundTasks, user: dict = Depends(current_user)):
    if stage not in pipeline.STAGES:
        raise HTTPException(404, f"Unknown stage '{stage}'. Use one of: {', '.join(pipeline.STAGES)}.")
    if len(body.source) > MAX_SOURCE_CHARS:
        raise HTTPException(413, f"Programs can be at most {MAX_SOURCE_CHARS} characters long.")
    if not ratelimit.hit(f"compile:{user['id']}", COMPILE_MAX_PER_MINUTE, 60.0):
        raise HTTPException(429, "You are running programs too quickly. Wait a moment and try again.")
    result = pipeline.run(stage, body.source, load_for(user))
    stage_result = result["results"].get(stage)
    if stage_result is None:
        status, detail = "error", f"blocked by {result['blocked_by']} errors"
    else:
        status = "ok" if stage_result["ok"] else "error"
        detail = "" if stage_result["ok"] else f"{len(stage_result['errors'])} error(s)"
    background_tasks.add_task(logs.record, user, f"run_{stage}", status, detail, source=body.source)
    return result
