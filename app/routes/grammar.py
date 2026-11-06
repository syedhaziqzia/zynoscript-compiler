"""Read, change and reset the signed-in user's language definition."""
import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from .. import logs
from ..auth import current_user, invalidate_session_cache
from ..db import connect
from ..engines import grammar as G

router = APIRouter(prefix="/api/grammar", tags=["grammar"])


def load_for(user: dict) -> dict:
    return G.normalize(json.loads(user["grammar_json"])) if user.get("grammar_json") else G.default()


def payload(g: dict) -> dict:
    norm = G.normalize(g)
    return {"grammar": norm, "bnf": G.bnf(norm), "keyword_roles": G.KEYWORD_ROLES, "operator_roles": G.OPERATOR_ROLES}


class GrammarIn(BaseModel):
    keywords: dict[str, str]
    operators: dict[str, str]


@router.get("")
def get_grammar(user: dict = Depends(current_user)):
    return payload(load_for(user))


@router.put("")
def update_grammar(body: GrammarIn, user: dict = Depends(current_user)):
    g = {"name": G.DEFAULT_GRAMMAR["name"], "keywords": dict(body.keywords), "operators": dict(body.operators)}
    problems = G.validate(g)
    if problems:
        logs.record(user, "grammar_update", "error", "; ".join(problems)[:200])
        raise HTTPException(422, {"message": "The grammar has problems.", "problems": problems})
    with connect() as conn:
        conn.execute("UPDATE users SET grammar_json = ? WHERE id = ?", (json.dumps(g), user["id"]))
    invalidate_session_cache(user_id=user["id"])
    logs.record(user, "grammar_update")
    return payload(g)


@router.post("/reset")
def reset_grammar(user: dict = Depends(current_user)):
    with connect() as conn:
        conn.execute("UPDATE users SET grammar_json = NULL WHERE id = ?", (user["id"],))
    invalidate_session_cache(user_id=user["id"])
    logs.record(user, "grammar_reset")
    return payload(G.default())
