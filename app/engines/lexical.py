"""Engine 1 - Lexical analysis.   input: source text   output: tokens + lexical errors."""
import re

from .grammar import DELIMITERS, normalize

CATEGORY = {
    "ID": "Identifier", "NUM": "Integer Constant", "DEC": "Float Constant", "STR": "String Constant",
    "CHR": "Character Constant", "TRUE": "Boolean Constant", "FALSE": "Boolean Constant",
    "ASSIGN": "Assignment Operator", "ADD": "Addition Operator", "SUB": "Subtraction Operator",
    "MUL": "Multiplication Operator", "DIV": "Division Operator", "GT": "Greater Than Operator",
    "LT": "Less Than Operator", "EQ": "Equal Comparison Operator", "NE": "Not Equal Comparison Operator",
    "AND": "Logical AND Operator", "OR": "Logical OR Operator", "NOT": "Logical NOT Operator",
    "CAST": "Type Cast Operator",
    "LPAREN": "Left Parenthesis", "RPAREN": "Right Parenthesis", "LBRACE": "Left Brace",
    "RBRACE": "Right Brace", "SEMI": "Semicolon"}


def _build(grammar):
    """Compiles the grammar into one regex. Longest operators go first (so '&&~' is not '&&' + '~')."""
    ops = sorted([o for o in grammar["operators"].values() if o], key=len, reverse=True)
    op_parts = []
    for o in ops:
        esc = re.escape(o)
        # If an operator starts with a word character (like 'as~'), require a leading word boundary
        if re.match(r"^[A-Za-z_]", o):
            esc = r"\b" + esc
        if re.match(r".*[A-Za-z0-9_]$", o):
            esc = esc + r"\b"
        op_parts.append(esc)
    parts = [
        ("BLOCK", r"/~~[\s\S]*?~~/|#~[\s\S]*?~#"),
        ("OPENBLOCK", r"/~~|#~"),
        ("COMMENT", r"//[^\n]*"),
        ("DEC", r"\d+\.\d+"),
        ("NUM", r"\d+"),
        ("STR", r'"[^"\n]*"'),
        ("CHR", r"'[^'\n]'"),
        ("OP", "|".join(op_parts) + r"|[(){};]"),
        ("ID", r"[A-Za-z_]\w*"),
        ("NL", r"\n"),
        ("SKIP", r"[ \t\r]+"),
        ("BAD", r"."),
    ]
    return re.compile("|".join(f"(?P<{n}>{rx})" for n, rx in parts))


def run(source: str, grammar: dict) -> dict:
    grammar = normalize(grammar)
    word_role = {w: r for r, w in grammar["keywords"].items()}
    op_role = {w: r for r, w in grammar["operators"].items()}
    tokens, errors, line, line_start = [], [], 1, 0
    for m in _build(grammar).finditer(source):
        kind, text, col = m.lastgroup, m.group(), m.start() - line_start + 1
        if kind == "NL":
            line, line_start = line + 1, m.end()
        elif kind == "BLOCK":                      # block comment: skip it but keep line numbers right
            breaks = text.count("\n")
            if breaks:
                line, line_start = line + breaks, m.start() + text.rfind("\n") + 1
        elif kind == "OPENBLOCK":
            closer = "~~/" if text == "/~~" else "~#"
            errors.append({"line": line, "col": col, "message": f"unterminated block comment (missing '{closer}')"})
            break
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
