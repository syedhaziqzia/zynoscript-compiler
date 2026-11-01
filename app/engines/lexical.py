"""Engine 1 - Lexical analysis.   input: source text   output: tokens + lexical errors."""
import re

from .grammar import DELIMITERS

CATEGORY = {
    "ID": "Identifier", "NUM": "Integer Constant", "DEC": "Float Constant", "STR": "String Constant",
    "CHR": "Character Constant", "TRUE": "Boolean Constant", "FALSE": "Boolean Constant",
    "ASSIGN": "Assignment Operator", "ADD": "Addition Operator", "SUB": "Subtraction Operator",
    "MUL": "Multiplication Operator", "DIV": "Division Operator", "GT": "Greater Than Operator",
    "LT": "Less Than Operator", "EQ": "Equal Comparison Operator", "NE": "Not Equal Comparison Operator",
    "AND": "Logical AND Operator", "OR": "Logical OR Operator", "NOT": "Logical NOT Operator",
    "LPAREN": "Left Parenthesis", "RPAREN": "Right Parenthesis", "LBRACE": "Left Brace",
    "RBRACE": "Right Brace", "SEMI": "Semicolon"}


def _build(grammar):
    """Compiles the grammar into one regex. Longest operators go first (so '&&~' is not '&&' + '~')."""
    ops = sorted(grammar["operators"].values(), key=len, reverse=True)
    parts = [("COMMENT", r"//[^\n]*"), ("DEC", r"\d+\.\d+"), ("NUM", r"\d+"), ("STR", r'"[^"\n]*"'), ("CHR", r"'[^'\n]'"),
             ("ID", r"[A-Za-z_]\w*"), ("OP", "|".join(re.escape(o) for o in ops) + r"|[(){};]"),
             ("NL", r"\n"), ("SKIP", r"[ \t\r]+"), ("BAD", r".")]
    return re.compile("|".join(f"(?P<{n}>{rx})" for n, rx in parts))


def run(source: str, grammar: dict) -> dict:
    word_role = {w: r for r, w in grammar["keywords"].items()}
    op_role = {w: r for r, w in grammar["operators"].items()}
    tokens, errors, line, line_start = [], [], 1, 0
    for m in _build(grammar).finditer(source):
        kind, text, col = m.lastgroup, m.group(), m.start() - line_start + 1
        if kind == "NL":
            line, line_start = line + 1, m.end()
        elif kind in ("SKIP", "COMMENT"):
            continue
        elif kind == "BAD":
            what = {'"': "unterminated string literal", "'": "invalid character literal"}.get(text, f"unknown character '{text}'")
            errors.append({"line": line, "col": col, "message": what})
        else:
            if kind == "ID" and text in word_role:
                role = word_role[text]
                kind = role
                category = CATEGORY.get(role, "Keyword")
            elif kind == "OP":
                kind = DELIMITERS.get(text) or op_role[text]
                category = CATEGORY[kind]
            else:
                category = CATEGORY[kind]
            tokens.append({"line": line, "col": col, "lexeme": text, "kind": kind, "category": category})
    summary, ids, cats = {}, {}, {}
    for t in tokens:
        summary[t["category"]] = summary.get(t["category"], 0) + 1
        cat = cats.setdefault(t["category"], {"category": t["category"], "count": 0, "lexemes": []})
        cat["count"] += 1
        if t["lexeme"] not in cat["lexemes"]:
            cat["lexemes"].append(t["lexeme"])
        if t["kind"] == "ID":                      # identifier list: every identifier once (no types; that is semantic work)
            e = ids.setdefault(t["lexeme"], {"name": t["lexeme"], "first_line": t["line"], "count": 0})
            e["count"] += 1
    # line-by-line analysis: every source line with the tokens found on it
    src_lines = source.split("\n")
    per_line = [{"line": n, "text": text, "tokens": []} for n, text in enumerate(src_lines, 1)]
    for t in tokens:
        per_line[t["line"] - 1]["tokens"].append({"lexeme": t["lexeme"], "category": t["category"]})
    return {"stage": "lexical", "ok": not errors, "tokens": tokens, "errors": errors,
            "summary": summary, "identifiers": list(ids.values()), "count": len(tokens),
            "lines": per_line, "categories": list(cats.values())}
