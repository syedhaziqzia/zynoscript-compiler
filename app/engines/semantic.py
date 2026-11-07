"""Engine 3 - Semantic analysis.   input: AST   output: symbol table + semantic errors."""
from .grammar import normalize, type_label

NUMERIC = ("int", "float")
ARITH, COMPARE, LOGIC = ("ADD", "SUB", "MUL", "DIV"), ("GT", "LT"), ("AND", "OR")
ALLOWED_CASTS = {
    ("int", "int"), ("float", "float"), ("string", "string"), ("bool", "bool"), ("char", "char"),
    ("int", "float"), ("float", "int"),
    ("int", "string"), ("float", "string"), ("bool", "string"), ("char", "string"),
    ("string", "int"), ("string", "float"),
    ("bool", "int"), ("int", "bool"),
    ("char", "int"), ("int", "char"),
}


class Analyzer:
    def __init__(self, grammar):
        self.g, self.symbols, self.errors = normalize(grammar), {}, []

    def label(self, t):
        return type_label(self.g, t)

    def error(self, line, rule, message):
        self.errors.append({"line": line, "rule": rule, "message": message})

    @staticmethod
    def compatible(target, got):
        return got == target or (target == "float" and got == "int")      # an integer fits in a float

    def visit(self, stmts):
        for s in stmts:
            k = s["node"]
            if k == "decl":
                got = self.type_of(s["init"]) if s["init"] else None
                declared = (got or "int") if s["type"] == "auto" else s["type"]     # let x := 5;  -> type of the value
                if s["name"] in self.symbols:
                    self.error(s["line"], 1, f"variable '{s['name']}' is already declared at line {self.symbols[s['name']]['line']}")
                else:
                    self.symbols[s["name"]] = {"type": declared, "line": s["line"]}
                if got and not self.compatible(declared, got):
                    self.error(s["line"], 3, f"cannot store {self.label(got)} value in {self.label(declared)} variable '{s['name']}'")
            elif k == "assign":
                got = self.type_of(s["value"])
                sym = self.symbols.get(s["name"])
                if sym is None:
                    self.error(s["line"], 2, f"variable '{s['name']}' is not declared")
                elif got and not self.compatible(sym["type"], got):
                    self.error(s["line"], 3, f"cannot store {self.label(got)} value in {self.label(sym['type'])} variable '{s['name']}'")
            elif k in ("if", "while"):
                got = self.type_of(s["cond"])
                if got and got != "bool":
                    self.error(s["line"], 6, f"condition must be {self.label('bool')} but it is {self.label(got)}")
                self.visit(s["then"] if k == "if" else s["body"])
                if k == "if" and s["else"] is not None:
                    self.visit(s["else"])
            elif k == "print":
                self.type_of(s["value"])

    def type_of(self, e):
        """Type of an expression, or None if it is unknown because of an earlier error."""
        k = e["node"]
        if k == "lit":
            return e["type"]
        if k == "var":
            if e["name"] not in self.symbols:
                self.error(e["line"], 2, f"variable '{e['name']}' is not declared")
                return None
            return self.symbols[e["name"]]["type"]
        if k == "cast":
            src_t = self.type_of(e["expr"])
            target_t = e["target"]
            if src_t is None:
                return target_t
            if (src_t, target_t) not in ALLOWED_CASTS:
                self.error(e["line"], 8, f"cannot cast {self.label(src_t)} to {self.label(target_t)} using '{e['sym']}'")
                return None
            return target_t
        if k == "un":
            if e.get("op") == "NEG":
                t = self.type_of(e["operand"])
                if t is not None:
                    if t in ("int", "float"):
                        return t
                    self.error(e["line"], 5, f"cannot negate a {self.label(t)} value")
                return None
            t = self.type_of(e["operand"])
            if t is not None and t != "bool":
                self.error(e["line"], 7, f"operator '{e['sym']}' needs a {self.label('bool')} operand but got {self.label(t)}")
                return None
            return t
        lt, rt = self.type_of(e["left"]), self.type_of(e["right"])
        if lt is None or rt is None:
            return None
        op, sym, line = e["op"], e["sym"], e["line"]
        if op == "ADD" and lt == "string" and rt == "string":
            return "string"
        if op in ARITH + COMPARE:
            if lt not in NUMERIC or rt not in NUMERIC:
                self.error(line, 4, f"operator '{sym}' needs numeric ({self.label('int')} or {self.label('float')}) operands but got {self.label(lt)} and {self.label(rt)}")
                return None
            return "bool" if op in COMPARE else ("float" if "float" in (lt, rt) else "int")
        if op in LOGIC:
            if lt != "bool" or rt != "bool":
                self.error(line, 7, f"operator '{sym}' needs {self.label('bool')} operands but got {self.label(lt)} and {self.label(rt)}")
                return None
            return "bool"
        if lt != rt and not (lt in NUMERIC and rt in NUMERIC):               # EQ / NE
            self.error(line, 5, f"operator '{sym}' cannot compare {self.label(lt)} with {self.label(rt)}")
            return None
        return "bool"


def run(ast: list, grammar: dict) -> dict:
    a = Analyzer(grammar)
    a.visit(ast)
    symbols = [{"name": n, "type": a.label(v["type"]), "line": v["line"]} for n, v in a.symbols.items()]
    return {"stage": "semantic", "ok": not a.errors, "symbols": symbols, "errors": a.errors}
