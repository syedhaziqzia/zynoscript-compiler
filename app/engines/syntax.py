"""Engine 2 - Syntax analysis (recursive descent).   input: token list   output: AST + syntax error."""
from .grammar import DELIMITERS, TYPE_OF_ROLE, lexeme, normalize, type_label

REL_ROLES = ("GT", "LT", "EQ", "NE")
LITERALS = {"NUM": "int", "DEC": "float", "STR": "string", "CHR": "char", "TRUE": "bool", "FALSE": "bool"}


class ParseError(Exception):
    def __init__(self, token, message):
        super().__init__(message)
        self.line, self.col, self.message = token["line"], token["col"], message


class Parser:
    """One method per non-terminal. Nodes are plain dicts so the tree can be sent to the browser as JSON."""

    def __init__(self, tokens, grammar):
        self.t, self.i, self.g = tokens, 0, normalize(grammar)
        last = tokens[-1] if tokens else {"line": 1, "col": 1, "lexeme": ""}
        self.eof = {"kind": "EOF", "lexeme": "end of file", "line": last["line"], "col": last["col"] + len(last["lexeme"])}

    @property
    def cur(self):
        return self.t[self.i] if self.i < len(self.t) else self.eof

    def show(self, kind):
        return {"ID": "identifier", "EOF": "end of file"}.get(kind) or lexeme(self.g, kind)

    def match(self, kind):
        tok = self.cur
        if tok["kind"] != kind:
            raise ParseError(tok, f"expected '{self.show(kind)}' but found '{tok['lexeme']}'")
        self.i += 1
        return tok

    def accept(self, kind):
        if self.cur["kind"] == kind:
            self.i += 1
            return True
        return False

    # program -> stmt_list HALT [ ';' ] EOF
    def program(self):
        body = self.stmt_list()
        self.match("HALT"); self.accept("SEMI"); self.match("EOF")
        return body

    def stmt_list(self):
        out = []
        while self.cur["kind"] not in ("EOF", "RBRACE", "HALT"):
            out.append(self.stmt())
        return out

    def stmt(self):
        tok = self.cur
        kind, line = tok["kind"], tok["line"]
        if kind == "LET":
            self.i += 1
            ttok = self.cur
            if ttok["kind"] == "ID":                     # untyped: let x := 5  (type inferred from the value)
                name = self.match("ID")["lexeme"]
                if self.cur["kind"] != "ASSIGN":
                    raise ParseError(self.cur, f"'{name}' has no type, so it needs a value: {lexeme(self.g, 'LET')} {name} {lexeme(self.g, 'ASSIGN')} ...")
                self.i += 1
                init = self.expr()
                self.accept("SEMI")
                return {"node": "decl", "type": "auto", "name": name, "init": init, "line": line}
            if ttok["kind"] not in TYPE_OF_ROLE:
                kinds = ", ".join(lexeme(self.g, r) for r in TYPE_OF_ROLE)
                raise ParseError(ttok, f"expected a type ({kinds}) or a name but found '{ttok['lexeme']}'")
            self.i += 1
            name = self.match("ID")["lexeme"]
            init = self.expr() if self.accept("ASSIGN") else None
            self.accept("SEMI")
            return {"node": "decl", "type": TYPE_OF_ROLE[ttok["kind"]], "name": name, "init": init, "line": line}
        if kind == "ID":
            self.i += 1
            self.match("ASSIGN")
            value = self.expr()
            self.accept("SEMI")
            return {"node": "assign", "name": tok["lexeme"], "value": value, "line": line}
        if kind in ("IF", "WHILE"):
            self.i += 1
            cond = self.expr()                          # parentheses are optional: (x <<= y) is just a grouped expr
            body = self.block()
            if kind == "WHILE":
                return {"node": "while", "cond": cond, "body": body, "line": line}
            other = self.block() if self.accept("ELSE") else None
            return {"node": "if", "cond": cond, "then": body, "else": other, "line": line}
        if kind == "PRINT":
            self.i += 1
            value = self.expr()
            self.accept("SEMI")
            return {"node": "print", "value": value, "line": line}
        raise ParseError(tok, f"a statement cannot start with '{tok['lexeme']}'")

    def block(self):
        if self.cur["kind"] != "LBRACE":               # a single statement may be written without braces
            return [self.stmt()]
        self.match("LBRACE")
        body = self.stmt_list()
        self.match("RBRACE")
        return body

    def binary(self, lower, roles):
        left = lower()
        while self.cur["kind"] in roles:
            op = self.cur
            self.i += 1
            left = {"node": "bin", "op": op["kind"], "sym": op["lexeme"], "left": left, "right": lower(), "line": op["line"]}
        return left

    def expr(self):
        return self.binary(lambda: self.binary(self.rel, ("AND",)), ("OR",))

    def rel(self):
        left = self.binary(lambda: self.binary(self.cast_expr, ("MUL", "DIV")), ("ADD", "SUB"))
        if self.cur["kind"] in REL_ROLES:
            op = self.cur
            self.i += 1
            right = self.binary(lambda: self.binary(self.cast_expr, ("MUL", "DIV")), ("ADD", "SUB"))
            left = {"node": "bin", "op": op["kind"], "sym": op["lexeme"], "left": left, "right": right, "line": op["line"]}
        return left

    def cast_expr(self):
        left = self.factor()
        while self.cur["kind"] == "CAST":
            op = self.cur
            self.i += 1
            ttok = self.cur
            if ttok["kind"] not in TYPE_OF_ROLE:
                kinds = ", ".join(lexeme(self.g, r) for r in TYPE_OF_ROLE)
                raise ParseError(ttok, f"expected a target type ({kinds}) after '{op['lexeme']}' but found '{ttok['lexeme']}'")
            self.i += 1
            target_type = TYPE_OF_ROLE[ttok["kind"]]
            left = {"node": "cast", "target": target_type, "target_lexeme": ttok["lexeme"], "sym": op["lexeme"], "expr": left, "line": op["line"]}
        return left

    def factor(self):
        tok = self.cur
        kind = tok["kind"]
        if kind == "SUB":
            self.i += 1
            inner = self.factor()
            return {"node": "un", "op": "NEG", "sym": lexeme(self.g, "SUB"), "operand": inner, "line": tok["line"]}
        if kind in LITERALS:
            self.i += 1
            return {"node": "lit", "type": LITERALS[kind], "value": tok["lexeme"], "line": tok["line"]}
        if kind == "ID":
            self.i += 1
            return {"node": "var", "name": tok["lexeme"], "line": tok["line"]}
        if kind == "NOT":
            self.i += 1
            return {"node": "un", "op": "NOT", "sym": tok["lexeme"], "operand": self.factor(), "line": tok["line"]}
        if kind == "LPAREN":
            self.i += 1
            inner = self.expr()
            self.match("RPAREN")
            return inner
        raise ParseError(tok, f"expected an expression but found '{tok['lexeme']}'")


def tree_text(nodes, depth=0):
    """Indented text drawing of the AST for the UI."""
    out, pad = [], "  " * depth
    for n in nodes if isinstance(nodes, list) else [nodes]:
        k = n["node"]
        if k == "decl":
            out.append(f"{pad}Declaration: {'(inferred)' if n['type'] == 'auto' else n['type']} {n['name']}")
            if n["init"]: out += tree_text(n["init"], depth + 1)
        elif k == "assign":
            out.append(f"{pad}Assignment: {n['name']}"); out += tree_text(n["value"], depth + 1)
        elif k == "print":
            out.append(f"{pad}Print"); out += tree_text(n["value"], depth + 1)
        elif k in ("if", "while"):
            out.append(f"{pad}{'If' if k == 'if' else 'While'}")
            out.append(f"{pad}  Condition"); out += tree_text(n["cond"], depth + 2)
            out.append(f"{pad}  {'Then' if k == 'if' else 'Body'}"); out += tree_text(n["then"] if k == "if" else n["body"], depth + 2)
            if k == "if" and n["else"] is not None:
                out.append(f"{pad}  Else"); out += tree_text(n["else"], depth + 2)
        elif k == "cast":
            out.append(f"{pad}TypeCast: {n['sym']} {n['target']}"); out += tree_text(n["expr"], depth + 1)
        elif k == "bin":
            out.append(f"{pad}Operator: {n['sym']}"); out += tree_text([n["left"], n["right"]], depth + 1)
        elif k == "un":
            out.append(f"{pad}Negate: {n['sym']}" if n.get("op") == "NEG" else f"{pad}Operator: {n['sym']}")
            out += tree_text(n["operand"], depth + 1)
        elif k == "lit":
            out.append(f"{pad}Literal ({n['type']}): {n['value']}")
        else:
            out.append(f"{pad}Variable: {n['name']}")
    return out


def run(tokens: list, grammar: dict) -> dict:
    try:
        ast = Parser(tokens, grammar).program()
    except ParseError as e:
        return {"stage": "syntax", "ok": False, "ast": None, "tree": "",
                "errors": [{"line": e.line, "col": e.col, "message": e.message}]}
    return {"stage": "syntax", "ok": True, "ast": ast, "tree": "\n".join(tree_text(ast)), "errors": []}
