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
    "AND": "Logical AND", "OR": "Logical OR", "NOT": "Logical NOT"}
DELIMITERS = {"(": "LPAREN", ")": "RPAREN", "{": "LBRACE", "}": "RBRACE", ";": "SEMI"}   # fixed punctuation
TYPE_OF_ROLE = {"INT": "int", "FLOAT": "float", "STRING": "string", "BOOL": "bool", "CHAR": "char"}

DEFAULT_GRAMMAR = {
    "name": "ZynoScript",
    "keywords": {"LET": "let", "PRINT": "beam", "IF": "whenTrue", "ELSE": "elseWay", "WHILE": "spin", "HALT": "halt",
                 "INT": "whole", "FLOAT": "part", "STRING": "phrase", "BOOL": "flag", "CHAR": "mark",
                 "TRUE": "true", "FALSE": "false"},
    "operators": {"ASSIGN": ":=", "ADD": "+~", "SUB": "-~", "MUL": "*~", "DIV": "/~", "GT": "=>>", "LT": "<<=",
                  "EQ": "~=", "NE": "~!", "AND": "&&~", "OR": "||~", "NOT": "!~"},
}

_WORD = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_SYMBOL = re.compile(r"^[^\sA-Za-z0-9_\"'(){};.]{1,4}$")


def default():
    return copy.deepcopy(DEFAULT_GRAMMAR)


def validate(g: dict) -> list[str]:
    """Returns a list of problems; an empty list means the grammar can be used."""
    problems = []
    for group, roles, pattern, hint in (("keywords", KEYWORD_ROLES, _WORD, "letters, digits and _ only, not starting with a digit"),
                                        ("operators", OPERATOR_ROLES, _SYMBOL, "1-4 symbol characters (no letters, digits, quotes, brackets, ; or .)")):
        table = g.get(group)
        if not isinstance(table, dict):
            return [f"'{group}' is missing."]
        for role, meaning in roles.items():
            word = table.get(role)
            if not isinstance(word, str) or not pattern.match(word):
                problems.append(f"{meaning}: '{word}' is not valid. Use {hint}.")
        values = [table.get(r) for r in roles]
        for dup in {v for v in values if values.count(v) > 1}:
            problems.append(f"'{dup}' is used more than once in {group}.")
    for role, meaning in OPERATOR_ROLES.items():
        word = g["operators"].get(role)
        if isinstance(word, str) and any(m in word for m in ("//", "#~", "~#")):
            problems.append(f"{meaning}: '{word}' clashes with comment markers (//, #~, ~#).")
    if not problems and set(g["keywords"].values()) & set(g["operators"].values()):
        problems.append("A keyword and an operator cannot be the same.")
    return problems


def lexeme(g: dict, role: str) -> str:
    """Text the user typed for a role, used in messages."""
    if role in g["keywords"]:
        return g["keywords"][role]
    if role in g["operators"]:
        return g["operators"][role]
    return next((c for c, r in DELIMITERS.items() if r == role), role)


def type_label(g: dict, canonical: str) -> str:
    """'int' -> the user's word for the integer type (whole)."""
    role = next(r for r, t in TYPE_OF_ROLE.items() if t == canonical)
    return g["keywords"][role]


def bnf(g: dict) -> str:
    k, o = g["keywords"], g["operators"]
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
term       -> factor {{ ('{o['MUL']}' | '{o['DIV']}') factor }}
factor     -> NUM | DEC | STR | CHR | '{k['TRUE']}' | '{k['FALSE']}' | ID
            | '(' expr ')' | '{o['NOT']}' factor
comment    -> '//' any text to end of line            (ignored by the compiler)
            | '#~' any text, may span lines '~#'      (block comment, ignored)"""
