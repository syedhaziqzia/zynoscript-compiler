"""Chains the engines. The engines never call each other: this module hands each one the previous output."""
from .engines import icg, lexical, output, semantic, syntax

STAGES = ["lexical", "syntax", "semantic", "icg", "output"]


def run(stage: str, source: str, grammar: dict) -> dict:
    """Runs every stage up to and including `stage`. Stops at the first stage that reports errors."""
    results, blocked_by = {}, None
    results["lexical"] = lexical.run(source, grammar)
    steps = [("syntax", lambda: syntax.run(results["lexical"]["tokens"], grammar)),
             ("semantic", lambda: semantic.run(results["syntax"]["ast"], grammar)),
             ("icg", lambda: icg.run(results["syntax"]["ast"], grammar)),
             ("output", lambda: output.run(results["syntax"]["ast"], grammar))]
    for name, call in steps:
        previous = STAGES[STAGES.index(name) - 1]
        if STAGES.index(name) > STAGES.index(stage):
            break
        if not results[previous]["ok"]:
            blocked_by = previous
            break
        results[name] = call()
    return {"stage": stage, "blocked_by": blocked_by, "results": results}
