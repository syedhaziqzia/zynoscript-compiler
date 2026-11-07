"""Engine 5 - Output (interpreter).   input: AST + grammar   output: printed lines, final variables, runtime errors.

Runs the program statement by statement. A step limit stops endless loops so the server cannot hang."""
from .grammar import lexeme, normalize, type_label

MAX_STEPS = 10000
DEFAULTS = {"int": 0, "float": 0.0, "string": "", "bool": False, "char": ""}


class RuntimeFault(Exception):
    def __init__(self, line, message):
        super().__init__(message)
        self.line, self.message = line, message


class Interpreter:
    def __init__(self, grammar):
        self.g = normalize(grammar)
        self.true_word = lexeme(self.g, "TRUE")
        self.false_word = lexeme(self.g, "FALSE")
        self.env, self.types, self.out, self.steps = {}, {}, [], 0

    def tick(self, line):
        self.steps += 1
        if self.steps > MAX_STEPS:
            raise RuntimeFault(line, f"stopped after {MAX_STEPS} steps (is a loop never finishing?)")

    def show(self, v):
        if isinstance(v, bool):
            return self.true_word if v else self.false_word
        return str(v)

    def literal(self, n):
        t, raw = n["type"], n["value"]
        if t == "bool":
            return raw == self.true_word
        if t == "int":
            return int(raw)
        if t == "float":
            return float(raw)
        if len(raw) >= 2 and raw[0] in "\"'" and raw[-1] == raw[0]:
            return raw[1:-1]
        return raw

    def eval_cast(self, val, target, line):
        if target == "string":
            return self.show(val)
        if target == "float":
            if isinstance(val, bool):
                return 1.0 if val else 0.0
            if isinstance(val, (int, float)):
                return float(val)
            if isinstance(val, str):
                try:
                    return float(val.strip())
                except ValueError:
                    raise RuntimeFault(line, f"cannot convert {type_label(self.g, 'string')} '{val}' to {type_label(self.g, 'float')}")
        if target == "int":
            if isinstance(val, bool):
                return 1 if val else 0
            if isinstance(val, int):
                return val
            if isinstance(val, float):
                return int(val)
            if isinstance(val, str):
                # Single-character mark -> ASCII/Unicode code point if not a digit string
                s = val.strip()
                try:
                    return int(s)
                except ValueError:
                    if len(val) == 1:
                        return ord(val)
                    raise RuntimeFault(line, f"cannot convert {type_label(self.g, 'string')} '{val}' to {type_label(self.g, 'int')}")
        if target == "bool":
            if isinstance(val, bool):
                return val
            if isinstance(val, (int, float)):
                return val != 0
        if target == "char":
            if isinstance(val, int) and not isinstance(val, bool):
                if 0 <= val <= 0x10FFFF:
                    return chr(val)
                raise RuntimeFault(line, f"character code {val} is out of range")
            if isinstance(val, str) and len(val) == 1:
                return val
        raise RuntimeFault(line, f"cannot cast value '{self.show(val)}' to {type_label(self.g, target)}")

    def eval(self, n):
        k, line = n["node"], n["line"]
        if k == "lit":
            return self.literal(n)
        if k == "var":
            if n["name"] not in self.env:
                raise RuntimeFault(line, f"'{n['name']}' has no value yet")
            return self.env[n["name"]]
        if k == "cast":
            val = self.eval(n["expr"])
            # Distinguish char variable/literal from multi-char string when casting to int
            expr_node = n["expr"]
            is_char_src = (
                (expr_node["node"] == "lit" and expr_node.get("type") == "char")
                or (expr_node["node"] == "var" and self.types.get(expr_node.get("name")) == "char")
            )
            if is_char_src and n["target"] == "int" and isinstance(val, str) and len(val) == 1:
                return ord(val)
            return self.eval_cast(val, n["target"], line)
        if k == "un":
            if n.get("op") == "NEG":
                return -self.eval(n["operand"])
            return not self.eval(n["operand"])
        a, b, op = self.eval(n["left"]), self.eval(n["right"]), n["op"]
        try:
            if op == "ADD":
                return a + b
            if op == "SUB":
                return a - b
            if op == "MUL":
                return a * b
            if op == "DIV":
                if b == 0:
                    raise RuntimeFault(line, "division by zero")
                return a / b if isinstance(a, float) or isinstance(b, float) else int(a / b)
            if op == "GT":
                return a > b
            if op == "LT":
                return a < b
            if op == "EQ":
                return a == b
            if op == "NE":
                return a != b
            if op == "AND":
                return bool(a and b)
            if op == "OR":
                return bool(a or b)
        except TypeError:
            raise RuntimeFault(line, f"cannot apply '{n['sym']}' to {type(a).__name__} and {type(b).__name__}")
        raise RuntimeFault(line, f"unknown operator '{op}'")

    def block(self, stmts):
        for s in stmts:
            self.stmt(s)

    def stmt(self, s):
        self.tick(s["line"])
        k = s["node"]
        if k == "decl":
            value = self.eval(s["init"]) if s["init"] else DEFAULTS.get(s["type"], 0)
            self.types[s["name"]] = s["type"]
            self.env[s["name"]] = float(value) if s["type"] == "float" and isinstance(value, int) and not isinstance(value, bool) else value
        elif k == "assign":
            value = self.eval(s["value"])
            if self.types.get(s["name"]) == "float" and isinstance(value, int) and not isinstance(value, bool):
                value = float(value)
            self.env[s["name"]] = value
        elif k == "print":
            self.out.append(self.show(self.eval(s["value"])))
        elif k == "if":
            if self.eval(s["cond"]):
                self.block(s["then"])
            elif s["else"] is not None:
                self.block(s["else"])
        elif k == "while":
            while self.eval(s["cond"]):
                self.tick(s["line"])
                self.block(s["body"])


def run(ast: list, grammar: dict) -> dict:
    """Runs the program. Returns printed lines, final variable values and any runtime error."""
    it, errors = Interpreter(grammar), []
    try:
        it.block(ast)
    except RuntimeFault as fault:
        errors.append({"line": fault.line, "message": fault.message})
    return {
        "stage": "output",
        "ok": not errors,
        "output": it.out,
        "variables": [{"name": n, "value": it.show(v)} for n, v in it.env.items()],
        "steps": it.steps,
        "errors": errors,
    }
