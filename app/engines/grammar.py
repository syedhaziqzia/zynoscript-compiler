"""The language definition. Plain data shared by all engines (no engine imports another engine).

A grammar maps ROLES to the words/symbols the user chose. Engines only ever look at roles, so renaming
`beam` to `show` in the UI changes the language without touching any engine code.
"""
import copy
import re

KEYWORD_ROLES = {          # role -> what it means
    "LET": "Variable declaration", "PRINT": "Print / output", "IF": "If condition", "ELSE": "Else condition",
    "WHILE": "Loop", "HALT": "End program", "INT": "Type: integer", "FLOAT": "Type: float",
    "STRING": "Type: string", "BOOL": "Type: boolean", "CHAR": "Type: character",
    "TRUE": "Boolean constant: true", "FALSE": "Boolean constant: false"}
OPERATOR_ROLES = {
    "ASSIGN": "Assignment", "ADD": "Addition", "SUB": "Subtraction", "MUL": "Multiplication", "DIV": "Division",
    "GT": "Greater than", "LT": "Less than", "EQ": "Equal comparison", "NE": "Not equal comparison",
    "AND": "Logical AND", "OR": "Logical OR", "NOT": "Logical NOT", "CAST": "Type cast"}
DELIMITERS = {"(": "LPAREN", ")": "RPAREN", "{": "LBRACE", "}": "RBRACE", ";": "SEMI"}   # fixed punctuation
TYPE_OF_ROLE = {"INT": "int", "FLOAT": "float", "STRING": "string", "BOOL": "bool", "CHAR": "char"}

DEFAULT_GRAMMAR = {
    "name": "ZynoScript",
    "keywords": {"LET": "let", "PRINT": "beam", "IF": "whenTrue", "ELSE": "elseWay", "WHILE": "spin", "HALT": "halt",
                 "INT": "whole", "FLOAT": "part", "STRING": "phrase", "BOOL": "flag", "CHAR": "mark",
                 "TRUE": "true", "FALSE": "false"},
    "operators": {"ASSIGN": ":=", "ADD": "+~", "SUB": "-~", "MUL": "*~", "DIV": "/~", "GT": "=>>", "LT": "<<=",
                  "EQ": "~=", "NE": "~!", "AND": "&&~", "OR": "||~", "NOT": "!~", "CAST": "as~"},
}

_WORD = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_SYMBOL = re.compile(r"^[^\sA-Za-z0-9_\"'(){};.]{1,4}$")
_CAST_TOKEN = re.compile(r"^([A-Za-z_][A-Za-z0-9_]*~?|[^\sA-Za-z0-9_\"'(){};.]{1,4})$")


def default():
    return copy.deepcopy(DEFAULT_GRAMMAR)


def normalize(g: dict | None) -> dict:
    """Fills in any newly added default roles so older saved user grammars keep working seamlessly."""
    base = default()
    if not isinstance(g, dict):
        return base
    if isinstance(g.get("keywords"), dict):
        base["keywords"].update(g["keywords"])
    if isinstance(g.get("operators"), dict):
        base["operators"].update(g["operators"])
    return base


def validate(g: dict) -> list[str]:
    """Returns a list of problems; an empty list means the grammar can be used."""
    problems = []
    if not isinstance(g.get("keywords"), dict):
        return ["'keywords' is missing."]
    if not isinstance(g.get("operators"), dict):
        return ["'operators' is missing."]

    # Ensure CAST defaults if omitted by an older client payload
    if "CAST" not in g["operators"]:
        g["operators"]["CAST"] = DEFAULT_GRAMMAR["operators"]["CAST"]

    for role, meaning in KEYWORD_ROLES.items():
        word = g["keywords"].get(role)
        if not isinstance(word, str) or not _WORD.match(word):
            problems.append(f"{meaning}: '{word}' is not valid. Use letters, digits and _ only, not starting with a digit.")
    kw_values = [g["keywords"].get(r) for r in KEYWORD_ROLES]
    for dup in {v for v in kw_values if kw_values.count(v) > 1}:
        problems.append(f"'{dup}' is used more than once in keywords.")

    for role, meaning in OPERATOR_ROLES.items():
        word = g["operators"].get(role)
        pat = _CAST_TOKEN if role == "CAST" else _SYMBOL
        hint = "1-4 symbol characters or word~ (e.g. as~)" if role == "CAST" else "1-4 symbol characters (no letters, digits, quotes, brackets, ; or .)"
        if not isinstance(word, str) or not pat.match(word):
            problems.append(f"{meaning}: '{word}' is not valid. Use {hint}.")
        elif any(m in word for m in ("//", "/~~", "~~/", "#~", "~#")):
            problems.append(f"{meaning}: '{word}' clashes with comment markers (//, /~~, ~~/).")
    op_values = [g["operators"].get(r) for r in OPERATOR_ROLES]
    for dup in {v for v in op_values if op_values.count(v) > 1}:
        problems.append(f"'{dup}' is used more than once in operators.")

    if not problems and set(g["keywords"].values()) & set(g["operators"].values()):
        problems.append("A keyword and an operator cannot be the same.")
    return problems


def lexeme(g: dict, role: str) -> str:
    """Text the user typed for a role, used in messages."""
    if role in g.get("keywords", {}):
        return g["keywords"][role]
    if role in g.get("operators", {}):
        return g["operators"][role]
    if role in DEFAULT_GRAMMAR["operators"]:
        return DEFAULT_GRAMMAR["operators"][role]
    return next((c for c, r in DELIMITERS.items() if r == role), role)


def type_label(g: dict, canonical: str) -> str:
    """'int' -> the user's word for the integer type (whole)."""
    role = next(r for r, t in TYPE_OF_ROLE.items() if t == canonical)
    return g["keywords"][role]


def bnf(g: dict) -> str:
    k, o = g["keywords"], g["operators"]
    cast_op = o.get("CAST", "as~")
    types = " | ".join(f"'{k[r]}'" for r in TYPE_OF_ROLE)
    return f"""program    -> stmt_list '{k['HALT']}' ';' EOF
stmt_list  -> stmt stmt_list | epsilon
stmt       -> decl | assign | if_stmt | while_stmt | print_stmt
decl       -> '{k['LET']}' type ID ';'
            | '{k['LET']}' type ID '{o['ASSIGN']}' expr ';'
            | '{k['LET']}' ID '{o['ASSIGN']}' expr ';'          (type taken from the value)
type       -> {types}
assign     -> ID '{o['ASSIGN']}' expr ';'
if_stmt    -> '{k['IF']}' expr block
            | '{k['IF']}' expr block '{k['ELSE']}' block
while_stmt -> '{k['WHILE']}' expr block
print_stmt -> '{k['PRINT']}' expr ';'
block      -> '{{' stmt_list '}}' | stmt                  (braces optional for one statement)
expr       -> or_expr
or_expr    -> and_expr {{ '{o['OR']}' and_expr }}
and_expr   -> rel_expr {{ '{o['AND']}' rel_expr }}
rel_expr   -> arith [ relop arith ]
relop      -> '{o['GT']}' | '{o['LT']}' | '{o['EQ']}' | '{o['NE']}'
arith      -> term {{ ('{o['ADD']}' | '{o['SUB']}') term }}
term       -> cast_expr {{ ('{o['MUL']}' | '{o['DIV']}') cast_expr }}
cast_expr  -> factor {{ '{cast_op}' type }}                 (explicit type cast, e.g. x {cast_op} {k['INT']})
factor     -> NUM | DEC | STR | CHR | '{k['TRUE']}' | '{k['FALSE']}' | ID
            | '(' expr ')' | '{o['NOT']}' factor
comment    -> '//' any text to end of line            (single-line comment, ignored)
            | '/~~' any text across lines '~~/'       (multi-line block comment, ignored)"""
