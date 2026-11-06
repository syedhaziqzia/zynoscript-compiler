"""Engine 4 - Intermediate code generation.   input: AST   output: three-address code + quadruples."""


class Generator:
    def __init__(self):
        self.quads, self.temps, self.labels = [], 0, 0

    def temp(self):
        self.temps += 1
        return f"t{self.temps}"

    def label(self):
        self.labels += 1
        return f"L{self.labels}"

    def emit(self, op, a1="", a2="", res=""):
        self.quads.append({"op": op, "arg1": a1, "arg2": a2, "result": res})

    def expr(self, e):
        k = e["node"]
        if k == "lit":
            return e["value"]
        if k == "var":
            return e["name"]
        if k == "cast":
            a, t = self.expr(e["expr"]), self.temp()
            self.emit(e["sym"], a, e["target"], t)
            return t
        if k == "un":
            a, t = self.expr(e["operand"]), self.temp()
            self.emit(e["sym"], a, "", t)
            return t
        a, b = self.expr(e["left"]), self.expr(e["right"])
        t = self.temp()
        self.emit(e["sym"], a, b, t)
        return t

    def stmts(self, nodes):
        for s in nodes:
            k = s["node"]
            if k == "decl" and s["init"] is not None:
                self.emit("=", self.expr(s["init"]), "", s["name"])
            elif k == "assign":
                self.emit("=", self.expr(s["value"]), "", s["name"])
            elif k == "print":
                self.emit("print", self.expr(s["value"]))
            elif k == "if":
                cond, l_else = self.expr(s["cond"]), self.label()
                self.emit("ifFalse", cond, "", l_else)
                self.stmts(s["then"])
                if s["else"] is None:
                    self.emit("label", "", "", l_else)
                else:
                    l_end = self.label()
                    self.emit("goto", "", "", l_end)
                    self.emit("label", "", "", l_else)
                    self.stmts(s["else"])
                    self.emit("label", "", "", l_end)
            elif k == "while":
                l_start, l_end = self.label(), self.label()
                self.emit("label", "", "", l_start)
                cond = self.expr(s["cond"])
                self.emit("ifFalse", cond, "", l_end)
                self.stmts(s["body"])
                self.emit("goto", "", "", l_start)
                self.emit("label", "", "", l_end)

    def tac(self):
        lines = ["# --- ZynoScript IR Engine v1.0 ---"]
        for q in self.quads:
            op, a1, a2, res = q["op"], q["arg1"], q["arg2"], q["result"]
            if op == "label":     lines.append(f"{res}:")
            elif op == "=":       lines.append(f"    {res} = {a1}")
            elif op == "goto":    lines.append(f"    goto {res}")
            elif op == "ifFalse": lines.append(f"    ifFalse {a1} goto {res}")
            elif op in ("print", "halt"): lines.append(f"    {op} {a1}".rstrip())
            elif a2 == "":        lines.append(f"    {res} = {op} {a1}")
            else:                 lines.append(f"    {res} = {a1} {op} {a2}")
        return lines


def run(ast: list, grammar: dict) -> dict:
    g = Generator()
    g.stmts(ast)
    g.emit("halt")
    return {"stage": "icg", "ok": True, "tac": g.tac(), "quads": g.quads, "errors": []}
