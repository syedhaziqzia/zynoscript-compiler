/* ZynoScript Compiler Studio - Browser UI
   Sections: Helpers, Auth, Studio View Toggles, Grammar Editor, Code Editor, Compiler Engines, Output Renderers, Activity Log, Admin. */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const STAGES = ["lexical", "syntax", "semantic", "icg", "output"];
const STAGE_TITLE = {
  lexical: "Lexical Analysis",
  syntax: "Syntax Analysis",
  semantic: "Semantic Analysis",
  icg: "Intermediate Code Generation",
  output: "Program Output"
};
const ACTIONS = [
  "login", "logout", "register", "grammar_update", "grammar_reset",
  "run_lexical", "run_syntax", "run_semantic", "run_icg", "run_output",
  "admin_reset_password", "admin_set_role", "admin_delete_user"
];

const GRAMMAR_GROUPS = {
  keywords: [
    { title: "Statements & Control Flow", roles: ["LET", "PRINT", "IF", "ELSE", "WHILE", "HALT"] },
    { title: "Primitive Data Types", roles: ["INT", "FLOAT", "STRING", "BOOL", "CHAR"] },
    { title: "Boolean Constants", roles: ["TRUE", "FALSE"] },
  ],
  operators: [
    { title: "Assignment & Arithmetic", roles: ["ASSIGN", "ADD", "SUB", "MUL", "DIV"] },
    { title: "Relational Comparisons", roles: ["GT", "LT", "EQ", "NE"] },
    { title: "Logical & Type Casting", roles: ["AND", "OR", "NOT", "CAST"] },
  ],
};

/* 1-to-1 Client-Side ZynoScript Compiler Engine (Mirrors app/engines/*.py) */
const ZS_DELIMITERS = { "(": "LPAREN", ")": "RPAREN", "{": "LBRACE", "}": "RBRACE", ";": "SEMI" };
const ZS_TYPE_OF_ROLE = { INT: "int", FLOAT: "float", STRING: "string", BOOL: "bool", CHAR: "char" };
const ZS_DEFAULT_GRAMMAR = {
  name: "ZynoScript",
  keywords: {
    LET: "let", PRINT: "beam", IF: "whenTrue", ELSE: "elseWay", WHILE: "spin", HALT: "halt",
    INT: "whole", FLOAT: "part", STRING: "phrase", BOOL: "flag", CHAR: "mark",
    TRUE: "true", FALSE: "false"
  },
  operators: {
    ASSIGN: ":=", ADD: "+~", SUB: "-~", MUL: "*~", DIV: "/~",
    GT: "=>>", LT: "<<=", EQ: "~=", NE: "~!", AND: "&&~", OR: "||~", NOT: "!~", CAST: "as~"
  }
};
const ZS_CATEGORY = {
  ID: "Identifier", NUM: "Integer Constant", DEC: "Float Constant", STR: "String Constant",
  CHR: "Character Constant", TRUE: "Boolean Constant", FALSE: "Boolean Constant",
  ASSIGN: "Assignment Operator", ADD: "Addition Operator", SUB: "Subtraction Operator",
  MUL: "Multiplication Operator", DIV: "Division Operator", GT: "Greater Than Operator",
  LT: "Less Than Operator", EQ: "Equal Comparison Operator", NE: "Not Equal Comparison Operator",
  AND: "Logical AND Operator", OR: "Logical OR Operator", NOT: "Logical NOT Operator",
  CAST: "Type Cast Operator",
  LPAREN: "Left Parenthesis", RPAREN: "Right Parenthesis", LBRACE: "Left Brace",
  RBRACE: "Right Brace", SEMI: "Semicolon"
};
const ZS_REL_ROLES = ["GT", "LT", "EQ", "NE"];
const ZS_LITERALS = { NUM: "int", DEC: "float", STR: "string", CHR: "char", TRUE: "bool", FALSE: "bool" };
const ZS_NUMERIC = ["int", "float"];
const ZS_ARITH = ["ADD", "SUB", "MUL", "DIV"];
const ZS_COMPARE = ["GT", "LT"];
const ZS_LOGIC = ["AND", "OR"];
const ZS_ALLOWED_CASTS = new Set([
  "int->int", "float->float", "string->string", "bool->bool", "char->char",
  "int->float", "float->int",
  "int->string", "float->string", "bool->string", "char->string",
  "string->int", "string->float",
  "bool->int", "int->bool",
  "char->int", "int->char"
]);

function zsNormalizeGrammar(g) {
  const base = JSON.parse(JSON.stringify(ZS_DEFAULT_GRAMMAR));
  if (!g || typeof g !== "object") return base;
  if (g.keywords && typeof g.keywords === "object") Object.assign(base.keywords, g.keywords);
  if (g.operators && typeof g.operators === "object") Object.assign(base.operators, g.operators);
  return base;
}

function zsLexeme(g, role) {
  if (g.keywords && role in g.keywords) return g.keywords[role];
  if (g.operators && role in g.operators) return g.operators[role];
  if (role in ZS_DEFAULT_GRAMMAR.operators) return ZS_DEFAULT_GRAMMAR.operators[role];
  for (const [ch, r] of Object.entries(ZS_DELIMITERS)) {
    if (r === role) return ch;
  }
  return role;
}

function zsTypeLabel(g, canonical) {
  for (const [r, t] of Object.entries(ZS_TYPE_OF_ROLE)) {
    if (t === canonical) return g.keywords[r];
  }
  return canonical;
}

function zsEscRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function zsRunLexical(source, rawGrammar) {
  const grammar = zsNormalizeGrammar(rawGrammar);
  const wordRole = {};
  for (const [r, w] of Object.entries(grammar.keywords)) wordRole[w] = r;
  const opRole = {};
  for (const [r, w] of Object.entries(grammar.operators)) opRole[w] = r;

  const ops = Object.values(grammar.operators).filter((o) => typeof o === "string" && o.length > 0).sort((a, b) => b.length - a.length);
  const opParts = ops.map((o) => {
    let esc = zsEscRegex(o);
    if (/^[A-Za-z_]/.test(o)) esc = "\\b" + esc;
    if (/[A-Za-z0-9_]$/.test(o)) esc = esc + "\\b";
    return esc;
  });
  const opPattern = opParts.join("|") + "|[(){};]";
  const masterRx = new RegExp(
    `(?<BLOCK>\\/~~[\\s\\S]*?~~\\/|#~[\\s\\S]*?~#)|(?<OPENBLOCK>\\/~~|#~)|(?<COMMENT>\\/\\/[^\\n]*)|(?<DEC>\\d+\\.\\d+)|(?<NUM>\\d+)|(?<STR>"[^"\\n]*")|(?<CHR>'[^'\\n]')|(?<OP>${opPattern})|(?<ID>[A-Za-z_]\\w*)|(?<NL>\\n)|(?<SKIP>[ \\t\\r]+)|(?<BAD>.)`,
    "g"
  );

  const tokens = [], errors = [];
  let line = 1, lineStart = 0;
  let m;
  while ((m = masterRx.exec(source)) !== null) {
    const groups = m.groups;
    let kind = null;
    for (const k of ["BLOCK", "OPENBLOCK", "COMMENT", "DEC", "NUM", "STR", "CHR", "OP", "ID", "NL", "SKIP", "BAD"]) {
      if (groups[k] !== undefined) { kind = k; break; }
    }
    const text = m[0];
    if (text.length === 0) { masterRx.lastIndex += 1; continue; }
    const col = m.index - lineStart + 1;
    if (kind === "NL") {
      line += 1;
      lineStart = m.index + text.length;
    } else if (kind === "BLOCK") {
      const breaks = (text.match(/\n/g) || []).length;
      if (breaks) {
        line += breaks;
        lineStart = m.index + text.lastIndexOf("\n") + 1;
      }
    } else if (kind === "OPENBLOCK") {
      const closer = text === "/~~" ? "~~/" : "~#";
      errors.push({ line, col, message: `unterminated block comment (missing '${closer}')` });
      break;
    } else if (kind === "SKIP" || kind === "COMMENT") {
      continue;
    } else if (kind === "BAD") {
      const what = text === '"' ? "unterminated string literal" : text === "'" ? "invalid character literal" : `unknown character '${text}'`;
      errors.push({ line, col, message: what });
    } else {
      let category;
      if (kind === "ID" && text in wordRole) {
        const role = wordRole[text];
        kind = role;
        category = ZS_CATEGORY[role] || "Keyword";
      } else if (kind === "OP") {
        kind = ZS_DELIMITERS[text] || opRole[text];
        category = ZS_CATEGORY[kind];
      } else {
        category = ZS_CATEGORY[kind];
      }
      tokens.push({ line, col, lexeme: text, kind, category });
    }
  }

  const summary = {}, ids = {}, cats = {};
  for (const t of tokens) {
    summary[t.category] = (summary[t.category] || 0) + 1;
    if (!cats[t.category]) cats[t.category] = { category: t.category, count: 0, lexemes: [] };
    cats[t.category].count += 1;
    if (!cats[t.category].lexemes.includes(t.lexeme)) cats[t.category].lexemes.push(t.lexeme);
    if (t.kind === "ID") {
      if (!ids[t.lexeme]) ids[t.lexeme] = { name: t.lexeme, first_line: t.line, count: 0 };
      ids[t.lexeme].count += 1;
    }
  }

  const srcLines = source.split("\n");
  const perLine = srcLines.map((text, idx) => ({ line: idx + 1, text, tokens: [] }));
  for (const t of tokens) {
    if (perLine[t.line - 1]) {
      perLine[t.line - 1].tokens.push({ lexeme: t.lexeme, category: t.category });
    }
  }

  return {
    stage: "lexical",
    ok: errors.length === 0,
    tokens,
    errors,
    summary,
    identifiers: Object.values(ids),
    count: tokens.length,
    lines: perLine,
    categories: Object.values(cats)
  };
}

function zsTreeText(nodes, depth = 0) {
  const out = [];
  const pad = "  ".repeat(depth);
  const list = Array.isArray(nodes) ? nodes : [nodes];
  for (const n of list) {
    const k = n.node;
    if (k === "decl") {
      out.push(`${pad}Declaration: ${n.type === "auto" ? "(inferred)" : n.type} ${n.name}`);
      if (n.init) out.push(...zsTreeText(n.init, depth + 1));
    } else if (k === "assign") {
      out.push(`${pad}Assignment: ${n.name}`);
      out.push(...zsTreeText(n.value, depth + 1));
    } else if (k === "print") {
      out.push(`${pad}Print`);
      out.push(...zsTreeText(n.value, depth + 1));
    } else if (k === "if" || k === "while") {
      out.push(`${pad}${k === "if" ? "If" : "While"}`);
      out.push(`${pad}  Condition`);
      out.push(...zsTreeText(n.cond, depth + 2));
      out.push(`${pad}  ${k === "if" ? "Then" : "Body"}`);
      out.push(...zsTreeText(k === "if" ? n.then : n.body, depth + 2));
      if (k === "if" && n.else !== null) {
        out.push(`${pad}  Else`);
        out.push(...zsTreeText(n.else, depth + 2));
      }
    } else if (k === "cast") {
      out.push(`${pad}TypeCast: ${n.sym} ${n.target}`);
      out.push(...zsTreeText(n.expr, depth + 1));
    } else if (k === "bin") {
      out.push(`${pad}Operator: ${n.sym}`);
      out.push(...zsTreeText([n.left, n.right], depth + 1));
    } else if (k === "un") {
      out.push(`${pad}Operator: ${n.sym}`);
      out.push(...zsTreeText(n.operand, depth + 1));
    } else if (k === "lit") {
      out.push(`${pad}Literal (${n.type}): ${n.value}`);
    } else {
      out.push(`${pad}Variable: ${n.name}`);
    }
  }
  return out;
}

function zsRunSyntax(tokens, rawGrammar) {
  const grammar = zsNormalizeGrammar(rawGrammar);
  let i = 0;
  const last = tokens.length ? tokens[tokens.length - 1] : { line: 1, col: 1, lexeme: "" };
  const eof = { kind: "EOF", lexeme: "end of file", line: last.line, col: last.col + last.lexeme.length };
  const cur = () => (i < tokens.length ? tokens[i] : eof);
  const show = (kind) => ({ ID: "identifier", EOF: "end of file" }[kind] || zsLexeme(grammar, kind));

  function fail(tok, message) {
    const err = new Error(message);
    err.isParse = true;
    err.line = tok.line;
    err.col = tok.col;
    err.message = message;
    throw err;
  }

  function match(kind) {
    const tok = cur();
    if (tok.kind !== kind) fail(tok, `expected '${show(kind)}' but found '${tok.lexeme}'`);
    i += 1;
    return tok;
  }

  function accept(kind) {
    if (cur().kind === kind) { i += 1; return true; }
    return false;
  }

  function program() {
    const body = stmtList();
    match("HALT"); match("SEMI"); match("EOF");
    return body;
  }

  function stmtList() {
    const out = [];
    while (!["EOF", "RBRACE", "HALT"].includes(cur().kind)) {
      out.push(stmt());
    }
    return out;
  }

  function stmt() {
    const tok = cur();
    const { kind, line } = tok;
    if (kind === "LET") {
      i += 1;
      const ttok = cur();
      if (ttok.kind === "ID") {
        const name = match("ID").lexeme;
        if (cur().kind !== "ASSIGN") {
          fail(cur(), `'${name}' has no type, so it needs a value: ${zsLexeme(grammar, "LET")} ${name} ${zsLexeme(grammar, "ASSIGN")} ...`);
        }
        i += 1;
        const init = expr();
        match("SEMI");
        return { node: "decl", type: "auto", name, init, line };
      }
      if (!(ttok.kind in ZS_TYPE_OF_ROLE)) {
        const kinds = Object.keys(ZS_TYPE_OF_ROLE).map(r => zsLexeme(grammar, r)).join(", ");
        fail(ttok, `expected a type (${kinds}) or a name but found '${ttok.lexeme}'`);
      }
      i += 1;
      const name = match("ID").lexeme;
      const init = accept("ASSIGN") ? expr() : null;
      match("SEMI");
      return { node: "decl", type: ZS_TYPE_OF_ROLE[ttok.kind], name, init, line };
    }
    if (kind === "ID") {
      i += 1;
      match("ASSIGN");
      const value = expr();
      match("SEMI");
      return { node: "assign", name: tok.lexeme, value, line };
    }
    if (kind === "IF" || kind === "WHILE") {
      i += 1;
      const cond = expr();
      const body = block();
      if (kind === "WHILE") return { node: "while", cond, body, line };
      const other = accept("ELSE") ? block() : null;
      return { node: "if", cond, then: body, else: other, line };
    }
    if (kind === "PRINT") {
      i += 1;
      const value = expr();
      match("SEMI");
      return { node: "print", value, line };
    }
    fail(tok, `a statement cannot start with '${tok.lexeme}'`);
  }

  function block() {
    if (cur().kind !== "LBRACE") return [stmt()];
    match("LBRACE");
    const body = stmtList();
    match("RBRACE");
    return body;
  }

  function binary(lower, roles) {
    let left = lower();
    while (roles.includes(cur().kind)) {
      const op = cur();
      i += 1;
      left = { node: "bin", op: op.kind, sym: op.lexeme, left, right: lower(), line: op.line };
    }
    return left;
  }

  function expr() {
    return binary(() => binary(rel, ["AND"]), ["OR"]);
  }

  function rel() {
    let left = binary(() => binary(castExpr, ["MUL", "DIV"]), ["ADD", "SUB"]);
    if (ZS_REL_ROLES.includes(cur().kind)) {
      const op = cur();
      i += 1;
      const right = binary(() => binary(castExpr, ["MUL", "DIV"]), ["ADD", "SUB"]);
      left = { node: "bin", op: op.kind, sym: op.lexeme, left, right, line: op.line };
    }
    return left;
  }

  function castExpr() {
    let left = factor();
    while (cur().kind === "CAST") {
      const op = cur();
      i += 1;
      const ttok = cur();
      if (!(ttok.kind in ZS_TYPE_OF_ROLE)) {
        const kinds = Object.keys(ZS_TYPE_OF_ROLE).map(r => zsLexeme(grammar, r)).join(", ");
        fail(ttok, `expected a target type (${kinds}) after '${op.lexeme}' but found '${ttok.lexeme}'`);
      }
      i += 1;
      const target = ZS_TYPE_OF_ROLE[ttok.kind];
      left = { node: "cast", target, target_lexeme: ttok.lexeme, sym: op.lexeme, expr: left, line: op.line };
    }
    return left;
  }

  function factor() {
    const tok = cur();
    const kind = tok.kind;
    if (kind in ZS_LITERALS) {
      i += 1;
      return { node: "lit", type: ZS_LITERALS[kind], value: tok.lexeme, line: tok.line };
    }
    if (kind === "ID") {
      i += 1;
      return { node: "var", name: tok.lexeme, line: tok.line };
    }
    if (kind === "NOT") {
      i += 1;
      return { node: "un", op: "NOT", sym: tok.lexeme, operand: factor(), line: tok.line };
    }
    if (kind === "LPAREN") {
      i += 1;
      const inner = expr();
      match("RPAREN");
      return inner;
    }
    fail(tok, `expected an expression but found '${tok.lexeme}'`);
  }

  try {
    const ast = program();
    return { stage: "syntax", ok: true, ast, tree: zsTreeText(ast).join("\n"), errors: [] };
  } catch (e) {
    if (e.isParse) {
      return { stage: "syntax", ok: false, ast: null, tree: "", errors: [{ line: e.line, col: e.col, message: e.message }] };
    }
    throw e;
  }
}

function zsRunSemantic(ast, rawGrammar) {
  const grammar = zsNormalizeGrammar(rawGrammar);
  const symbols = {}, errors = [];
  const label = (t) => zsTypeLabel(grammar, t);
  const error = (line, rule, message) => errors.push({ line, rule, message });
  const compatible = (target, got) => got === target || (target === "float" && got === "int");

  function typeOf(e) {
    const k = e.node;
    if (k === "lit") return e.type;
    if (k === "var") {
      if (!(e.name in symbols)) {
        error(e.line, 2, `variable '${e.name}' is not declared`);
        return null;
      }
      return symbols[e.name].type;
    }
    if (k === "cast") {
      const srcT = typeOf(e.expr);
      const targetT = e.target;
      if (srcT === null) return targetT;
      if (!ZS_ALLOWED_CASTS.has(`${srcT}->${targetT}`)) {
        error(e.line, 8, `cannot cast ${label(srcT)} to ${label(targetT)} using '${e.sym}'`);
        return null;
      }
      return targetT;
    }
    if (k === "un") {
      const t = typeOf(e.operand);
      if (t !== null && t !== "bool") {
        error(e.line, 7, `operator '${e.sym}' needs a ${label("bool")} operand but got ${label(t)}`);
        return null;
      }
      return t;
    }
    const lt = typeOf(e.left), rt = typeOf(e.right);
    if (lt === null || rt === null) return null;
    const { op, sym, line } = e;
    if (op === "ADD" && lt === "string" && rt === "string") {
      return "string";
    }
    if (ZS_ARITH.includes(op) || ZS_COMPARE.includes(op)) {
      if (!ZS_NUMERIC.includes(lt) || !ZS_NUMERIC.includes(rt)) {
        error(line, 4, `operator '${sym}' needs numeric (${label("int")} or ${label("float")}) operands but got ${label(lt)} and ${label(rt)}`);
        return null;
      }
      return ZS_COMPARE.includes(op) ? "bool" : (lt === "float" || rt === "float" ? "float" : "int");
    }
    if (ZS_LOGIC.includes(op)) {
      if (lt !== "bool" || rt !== "bool") {
        error(line, 7, `operator '${sym}' needs ${label("bool")} operands but got ${label(lt)} and ${label(rt)}`);
        return null;
      }
      return "bool";
    }
    if (lt !== rt && !(ZS_NUMERIC.includes(lt) && ZS_NUMERIC.includes(rt))) {
      error(line, 5, `operator '${sym}' cannot compare ${label(lt)} with ${label(rt)}`);
      return null;
    }
    return "bool";
  }

  function visit(stmts) {
    for (const s of stmts) {
      const k = s.node;
      if (k === "decl") {
        const got = s.init ? typeOf(s.init) : null;
        const declared = s.type === "auto" ? (got || "int") : s.type;
        if (s.name in symbols) {
          error(s.line, 1, `variable '${s.name}' is already declared at line ${symbols[s.name].line}`);
        } else {
          symbols[s.name] = { type: declared, line: s.line };
        }
        if (got && !compatible(declared, got)) {
          error(s.line, 3, `cannot store ${label(got)} value in ${label(declared)} variable '${s.name}'`);
        }
      } else if (k === "assign") {
        const got = typeOf(s.value);
        const sym = symbols[s.name];
        if (!sym) {
          error(s.line, 2, `variable '${s.name}' is not declared`);
        } else if (got && !compatible(sym.type, got)) {
          error(s.line, 3, `cannot store ${label(got)} value in ${label(sym.type)} variable '${s.name}'`);
        }
      } else if (k === "if" || k === "while") {
        const got = typeOf(s.cond);
        if (got && got !== "bool") {
          error(s.line, 6, `condition must be ${label("bool")} but it is ${label(got)}`);
        }
        visit(k === "if" ? s.then : s.body);
        if (k === "if" && s.else !== null) visit(s.else);
      } else if (k === "print") {
        typeOf(s.value);
      }
    }
  }

  visit(ast);
  const symList = Object.entries(symbols).map(([name, v]) => ({ name, type: label(v.type), line: v.line }));
  return { stage: "semantic", ok: errors.length === 0, symbols: symList, errors };
}

function zsRunIcg(ast) {
  const quads = [];
  let temps = 0, labels = 0;
  const temp = () => `t${++temps}`;
  const label = () => `L${++labels}`;
  const emit = (op, arg1 = "", arg2 = "", result = "") => quads.push({ op, arg1, arg2, result });

  function expr(e) {
    const k = e.node;
    if (k === "lit") return e.value;
    if (k === "var") return e.name;
    if (k === "cast") {
      const a = expr(e.expr), t = temp();
      emit(e.sym, a, e.target, t);
      return t;
    }
    if (k === "un") {
      const a = expr(e.operand), t = temp();
      emit(e.sym, a, "", t);
      return t;
    }
    const a = expr(e.left), b = expr(e.right);
    const t = temp();
    emit(e.sym, a, b, t);
    return t;
  }

  function stmts(nodes) {
    for (const s of nodes) {
      const k = s.node;
      if (k === "decl" && s.init !== null) {
        emit("=", expr(s.init), "", s.name);
      } else if (k === "assign") {
        emit("=", expr(s.value), "", s.name);
      } else if (k === "print") {
        emit("print", expr(s.value));
      } else if (k === "if") {
        const cond = expr(s.cond), lElse = label();
        emit("ifFalse", cond, "", lElse);
        stmts(s.then);
        if (s.else === null) {
          emit("label", "", "", lElse);
        } else {
          const lEnd = label();
          emit("goto", "", "", lEnd);
          emit("label", "", "", lElse);
          stmts(s.else);
          emit("label", "", "", lEnd);
        }
      } else if (k === "while") {
        const lStart = label(), lEnd = label();
        emit("label", "", "", lStart);
        const cond = expr(s.cond);
        emit("ifFalse", cond, "", lEnd);
        stmts(s.body);
        emit("goto", "", "", lStart);
        emit("label", "", "", lEnd);
      }
    }
  }

  stmts(ast);
  emit("halt");

  const tac = ["# --- ZynoScript IR Engine v1.0 ---"];
  for (const q of quads) {
    const { op, arg1: a1, arg2: a2, result: res } = q;
    if (op === "label") tac.push(`${res}:`);
    else if (op === "=") tac.push(`    ${res} = ${a1}`);
    else if (op === "goto") tac.push(`    goto ${res}`);
    else if (op === "ifFalse") tac.push(`    ifFalse ${a1} goto ${res}`);
    else if (op === "print" || op === "halt") tac.push(`    ${op} ${a1}`.replace(/\s+$/, ""));
    else if (a2 === "") tac.push(`    ${res} = ${op} ${a1}`);
    else tac.push(`    ${res} = ${a1} ${op} ${a2}`);
  }

  return { stage: "icg", ok: true, tac, quads, errors: [] };
}

function zsRunOutput(ast, rawGrammar) {
  const grammar = zsNormalizeGrammar(rawGrammar);
  const MAX_STEPS = 10000;
  const trueWord = zsLexeme(grammar, "TRUE");
  const falseWord = zsLexeme(grammar, "FALSE");
  const env = {}, types = {}, out = [];
  let steps = 0;

  const mkFloat = (v) => ({ __zsFloat: true, v: Number(v) });
  const isFloat = (x) => x && typeof x === "object" && x.__zsFloat === true;
  const numVal = (x) => (isFloat(x) ? x.v : x);

  function fault(line, message) {
    const err = new Error(message);
    err.isRuntime = true;
    err.line = line;
    err.message = message;
    throw err;
  }

  function tick(line) {
    steps += 1;
    if (steps > MAX_STEPS) fault(line, `stopped after ${MAX_STEPS} steps (is a loop never finishing?)`);
  }

  function show(v) {
    if (typeof v === "boolean") return v ? trueWord : falseWord;
    if (isFloat(v)) {
      return Number.isInteger(v.v) ? v.v.toFixed(1) : String(v.v);
    }
    return String(v);
  }

  function literal(n) {
    const { type: t, value: raw } = n;
    if (t === "bool") return raw === trueWord;
    if (t === "int") return parseInt(raw, 10);
    if (t === "float") return mkFloat(parseFloat(raw));
    if (raw.length >= 2 && (raw[0] === '"' || raw[0] === "'") && raw[raw.length - 1] === raw[0]) {
      return raw.slice(1, -1);
    }
    return raw;
  }

  function evalCast(val, target, line, isCharSrc) {
    if (target === "string") return show(val);
    if (target === "float") {
      if (typeof val === "boolean") return mkFloat(val ? 1.0 : 0.0);
      if (isFloat(val)) return val;
      if (typeof val === "number") return mkFloat(val);
      if (typeof val === "string") {
        const s = val.trim();
        const num = Number(s);
        if (s !== "" && !Number.isNaN(num)) return mkFloat(num);
        fault(line, `cannot convert ${zsTypeLabel(grammar, "string")} '${val}' to ${zsTypeLabel(grammar, "float")}`);
      }
    }
    if (target === "int") {
      if (isCharSrc && typeof val === "string" && val.length === 1) return val.charCodeAt(0);
      if (typeof val === "boolean") return val ? 1 : 0;
      if (isFloat(val)) return Math.trunc(val.v);
      if (typeof val === "number") return Math.trunc(val);
      if (typeof val === "string") {
        const s = val.trim();
        if (/^[+-]?\d+$/.test(s)) return parseInt(s, 10);
        if (val.length === 1) return val.charCodeAt(0);
        fault(line, `cannot convert ${zsTypeLabel(grammar, "string")} '${val}' to ${zsTypeLabel(grammar, "int")}`);
      }
    }
    if (target === "bool") {
      if (typeof val === "boolean") return val;
      if (isFloat(val)) return val.v !== 0;
      if (typeof val === "number") return val !== 0;
    }
    if (target === "char") {
      const nv = numVal(val);
      if (typeof nv === "number" && Number.isInteger(nv) && typeof val !== "boolean") {
        if (nv >= 0 && nv <= 0x10FFFF) return String.fromCodePoint(nv);
        fault(line, `character code ${nv} is out of range`);
      }
      if (typeof val === "string" && val.length === 1) return val;
    }
    fault(line, `cannot cast value '${show(val)}' to ${zsTypeLabel(grammar, target)}`);
  }

  function evalExpr(n) {
    const { node: k, line } = n;
    if (k === "lit") return literal(n);
    if (k === "var") {
      if (!(n.name in env)) fault(line, `'${n.name}' has no value yet`);
      return env[n.name];
    }
    if (k === "cast") {
      const val = evalExpr(n.expr);
      const exprNode = n.expr;
      const isCharSrc = (exprNode.node === "lit" && exprNode.type === "char") ||
                        (exprNode.node === "var" && types[exprNode.name] === "char");
      return evalCast(val, n.target, line, isCharSrc);
    }
    if (k === "un") return !evalExpr(n.operand);
    const a = evalExpr(n.left), b = evalExpr(n.right), op = n.op;
    const anyFloat = isFloat(a) || isFloat(b);
    const av = numVal(a), bv = numVal(b);
    if (op === "ADD") {
      if (typeof av === "string" && typeof bv === "string") return av + bv;
      return anyFloat ? mkFloat(av + bv) : av + bv;
    }
    if (op === "SUB") return anyFloat ? mkFloat(av - bv) : av - bv;
    if (op === "MUL") return anyFloat ? mkFloat(av * bv) : av * bv;
    if (op === "DIV") {
      if (bv === 0) fault(line, "division by zero");
      return anyFloat ? mkFloat(av / bv) : Math.trunc(av / bv);
    }
    if (op === "GT") return av > bv;
    if (op === "LT") return av < bv;
    if (op === "EQ") return av === bv;
    if (op === "NE") return av !== bv;
    if (op === "AND") return Boolean(av && bv);
    if (op === "OR") return Boolean(av || bv);
    fault(line, `unknown operator '${op}'`);
  }

  function execBlock(stmts) {
    for (const s of stmts) execStmt(s);
  }

  function execStmt(s) {
    tick(s.line);
    const k = s.node;
    if (k === "decl") {
      const defaults = { int: 0, float: mkFloat(0.0), string: "", bool: false, char: "" };
      let value = s.init ? evalExpr(s.init) : (defaults[s.type] ?? 0);
      types[s.name] = s.type;
      if (s.type === "float" && typeof value === "number") value = mkFloat(value);
      env[s.name] = value;
    } else if (k === "assign") {
      let value = evalExpr(s.value);
      if (types[s.name] === "float" && typeof value === "number") value = mkFloat(value);
      env[s.name] = value;
    } else if (k === "print") {
      out.push(show(evalExpr(s.value)));
    } else if (k === "if") {
      if (evalExpr(s.cond)) execBlock(s.then);
      else if (s.else !== null) execBlock(s.else);
    } else if (k === "while") {
      while (evalExpr(s.cond)) {
        tick(s.line);
        execBlock(s.body);
      }
    }
  }

  const errors = [];
  try {
    execBlock(ast);
  } catch (e) {
    if (e.isRuntime) errors.push({ line: e.line, message: e.message });
    else throw e;
  }

  return {
    stage: "output",
    ok: errors.length === 0,
    output: out,
    variables: Object.entries(env).map(([name, v]) => ({ name, value: show(v) })),
    steps,
    errors
  };
}

function compileLocal(stage, source, grammar) {
  const g = zsNormalizeGrammar(grammar);
  const stages = ["lexical", "syntax", "semantic", "icg", "output"];
  const results = {};
  let blocked_by = null;
  results.lexical = zsRunLexical(source, g);
  const steps = [
    ["syntax", () => zsRunSyntax(results.lexical.tokens, g)],
    ["semantic", () => zsRunSemantic(results.syntax.ast, g)],
    ["icg", () => zsRunIcg(results.syntax.ast, g)],
    ["output", () => zsRunOutput(results.syntax.ast, g)]
  ];
  for (const [name, call] of steps) {
    const prev = stages[stages.indexOf(name) - 1];
    if (stages.indexOf(name) > stages.indexOf(stage)) break;
    if (!results[prev].ok) {
      blocked_by = prev;
      break;
    }
    results[name] = call();
  }
  return { stage, blocked_by, results };
}

const compileCache = new Map();

const ZS_DEFAULT_ROLE_MEANINGS = {
  keyword_roles: {
    LET: "Declare a variable", PRINT: "Print output", IF: "If branch", ELSE: "Else branch",
    WHILE: "While loop", HALT: "End of program", INT: "Type: integer", FLOAT: "Type: decimal",
    STRING: "Type: text", BOOL: "Type: true/false", CHAR: "Type: single character",
    TRUE: "Boolean true", FALSE: "Boolean false"
  },
  operator_roles: {
    ASSIGN: "Assign value", ADD: "Addition", SUB: "Subtraction", MUL: "Multiplication",
    DIV: "Division", GT: "Greater than", LT: "Less than", EQ: "Equal to", NE: "Not equal to",
    AND: "Logical AND", OR: "Logical OR", NOT: "Logical NOT", CAST: "Type cast"
  }
};

const state = {
  user: null,
  grammar: {
    grammar: JSON.parse(JSON.stringify(ZS_DEFAULT_GRAMMAR)),
    keyword_roles: ZS_DEFAULT_ROLE_MEANINGS.keyword_roles,
    operator_roles: ZS_DEFAULT_ROLE_MEANINGS.operator_roles,
    bnf: ""
  },
  draft: JSON.parse(JSON.stringify(ZS_DEFAULT_GRAMMAR)),
  gtab: "keywords",
  selected: null,
  authMode: "login",
  lexTab: "tokens",
  icgTab: "tac",
  lastResults: null,
};

function toast(msg) {
  const t = $("#toast");
  if (!t) return;
  t.textContent = msg;
  t.hidden = false;
  t.classList.remove("is-visible");
  void t.offsetWidth;
  t.classList.add("is-visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    t.classList.remove("is-visible");
    setTimeout(() => { if (!t.classList.contains("is-visible")) t.hidden = true; }, 220);
  }, 2200);
}

/* ---------- Custom Rounded Dropdown System (No square native OS popups) ---------- */
function enhanceSelect(select) {
  if (!select) return null;
  if (select._enhanced) {
    select._enhanced.rebuild();
    return select._enhanced;
  }

  // Hide native select visually but keep it functional for change events and form data
  select.classList.add("custom-select-native");
  select.setAttribute("tabindex", "-1");
  select.setAttribute("aria-hidden", "true");

  const wrap = document.createElement("div");
  wrap.className = "custom-select-wrap";
  if (select.id === "sample") wrap.classList.add("align-right");
  if (select.hidden) wrap.hidden = true;

  select.parentNode.insertBefore(wrap, select);
  wrap.appendChild(select);

  // Trigger button
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "custom-select-trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  const ariaLabel = select.getAttribute("aria-label") || select.getAttribute("aria-labelledby");
  if (ariaLabel) trigger.setAttribute("aria-label", ariaLabel);

  const labelSpan = document.createElement("span");
  labelSpan.className = "custom-select-label";

  const arrowSpan = document.createElement("span");
  arrowSpan.className = "custom-select-arrow";
  arrowSpan.setAttribute("aria-hidden", "true");
  arrowSpan.innerHTML = typeof icon === "function" ? icon("chevron") : `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>`;

  trigger.appendChild(labelSpan);
  trigger.appendChild(arrowSpan);
  wrap.appendChild(trigger);

  // Custom rounded dropdown list
  const menu = document.createElement("div");
  menu.className = "custom-select-menu";
  menu.setAttribute("role", "listbox");
  menu.hidden = true;
  wrap.appendChild(menu);

  const checkIcon = `<svg class="ico cs-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;

  function syncValue() {
    const selOpt = select.options && select.selectedIndex >= 0 ? select.options[select.selectedIndex] : null;
    labelSpan.textContent = selOpt ? selOpt.text : (select.value || "");

    Array.from(menu.children).forEach((child) => {
      const isMatch = child.dataset.value === select.value;
      child.classList.toggle("is-selected", isMatch);
      child.setAttribute("aria-selected", String(isMatch));
    });
  }

  function rebuild() {
    menu.innerHTML = "";
    const opts = Array.from(select.options || []);
    opts.forEach((opt) => {
      const item = document.createElement("div");
      item.className = "custom-select-item" + (opt.value === select.value ? " is-selected" : "");
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", String(opt.value === select.value));
      item.dataset.value = opt.value;
      item.innerHTML = `<span>${esc(opt.text || opt.value)}</span>${checkIcon}`;

      item.addEventListener("click", (e) => {
        e.stopPropagation();
        if (select.value !== opt.value) {
          select.value = opt.value;
          syncValue();
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }
        close();
        trigger.focus();
      });
      menu.appendChild(item);
    });
    syncValue();
  }

  function open() {
    document.querySelectorAll(".custom-select-wrap.is-open").forEach((w) => {
      if (w !== wrap && w._closeCustomSelect) w._closeCustomSelect();
    });
    if (typeof toggleProfileDropdown === "function") toggleProfileDropdown(false);

    wrap.classList.add("is-open");
    menu.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
  }

  function close() {
    wrap.classList.remove("is-open");
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  }

  function toggle() {
    if (wrap.classList.contains("is-open")) close();
    else open();
  }

  wrap._closeCustomSelect = close;

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    toggle();
  });

  trigger.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!wrap.classList.contains("is-open")) {
        open();
      } else {
        const items = Array.from(menu.children);
        if (!items.length) return;
        const idx = items.findIndex((it) => it.classList.contains("is-selected"));
        const nextIdx = e.key === "ArrowDown" ? Math.min(items.length - 1, idx + 1) : Math.max(0, idx - 1);
        if (items[nextIdx]) items[nextIdx].click();
      }
    } else if (e.key === "Escape") {
      close();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  });

  // Watch for dynamic options updates and attribute changes
  const observer = new MutationObserver(() => {
    wrap.hidden = select.hidden;
    if (select.disabled) trigger.setAttribute("disabled", "");
    else trigger.removeAttribute("disabled");
    rebuild();
  });
  observer.observe(select, { childList: true, attributes: true, subtree: true, attributeFilter: ["hidden", "disabled"] });

  // Intercept programmatic value setter
  const valDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
  if (valDesc && valDesc.set) {
    Object.defineProperty(select, "value", {
      get() {
        return valDesc.get.call(this);
      },
      set(val) {
        valDesc.set.call(this, val);
        syncValue();
      },
      configurable: true
    });
  }

  const idxDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "selectedIndex");
  if (idxDesc && idxDesc.set) {
    Object.defineProperty(select, "selectedIndex", {
      get() {
        return idxDesc.get.call(this);
      },
      set(val) {
        idxDesc.set.call(this, val);
        syncValue();
      },
      configurable: true
    });
  }

  let isHidden = select.hidden;
  Object.defineProperty(select, "hidden", {
    get() {
      return isHidden;
    },
    set(val) {
      isHidden = Boolean(val);
      if (isHidden) select.setAttribute("hidden", "");
      else select.removeAttribute("hidden");
      wrap.hidden = isHidden;
    },
    configurable: true
  });

  rebuild();

  const api = { rebuild, syncValue, open, close, wrap, trigger, menu };
  select._enhanced = api;
  return api;
}

window.addEventListener("click", (e) => {
  document.querySelectorAll(".custom-select-wrap.is-open").forEach((wrap) => {
    if (!wrap.contains(e.target) && wrap._closeCustomSelect) wrap._closeCustomSelect();
  });
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.querySelectorAll(".custom-select-wrap.is-open").forEach((wrap) => {
      if (wrap._closeCustomSelect) wrap._closeCustomSelect();
    });
  }
});

/* ---------- View Navigation ---------- */
function showView(name) {
  if (name !== "auth") document.documentElement.classList.remove("show-auth-immediately");
  if (typeof toggleProfileDropdown === "function") toggleProfileDropdown(false);
  const topbar = $("#topbar");
  if (topbar) topbar.hidden = name === "auth";
  for (const v of ["auth", "workbench", "guide", "activity", "admin"]) {
    const el = $(`#${v}-view`);
    if (!el) continue;
    const show = v === name;
    if (show && el.hidden) {
      el.classList.remove("view-enter");
      void el.offsetWidth;
      el.classList.add("view-enter");
    }
    el.hidden = !show;
  }
  $$(".nav-btn").forEach((b) => b.classList.toggle("is-active", b.dataset.view === name));
  if (name === "activity") {
    if (state.user && state.user.role === "admin") {
      fillUserFilter();
    }
    loadLogs();
  }
  if (name === "admin") loadAdminDashboard();

  if (name === "guide") renderGuide();
  if (name === "auth" && typeof window._startAuthCompilerCanvas === "function") {
    window._startAuthCompilerCanvas();
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------- Authentication ---------- */
function renderAuthError(message, action = null, actionUser = null) {
  const errBox = $("#auth-error");
  if (!errBox) return;
  if (!message) {
    errBox.innerHTML = "";
    errBox.hidden = true;
    return;
  }

  errBox.hidden = false;
  let html = `<span class="form-error-icon" aria-hidden="true">!</span><div class="form-error-body"><span class="form-error-msg">${esc(message)}</span>`;

  if (action === "register") {
    html += `<button type="button" class="auth-switch-btn" data-switch="register" data-user="${esc(actionUser || '')}">Create account for "${esc(actionUser || '')}" &rarr;</button>`;
  } else if (action === "login") {
    html += `<button type="button" class="auth-switch-btn" data-switch="login" data-user="${esc(actionUser || '')}">Sign in as "${esc(actionUser || '')}" &rarr;</button>`;
  }

  html += `</div>`;
  errBox.innerHTML = html;

  const switchBtn = errBox.querySelector(".auth-switch-btn");
  if (switchBtn) {
    switchBtn.addEventListener("click", () => {
      const mode = switchBtn.dataset.switch;
      const user = switchBtn.dataset.user;
      setAuthMode(mode);
      if (user) $("#auth-user").value = user;
      $("#auth-pass").value = "";
      $("#auth-pass").focus();
      renderAuthError("");
    });
  }

  const card = $(".auth-card");
  if (card) {
    card.classList.remove("shake");
    void card.offsetWidth;
    card.classList.add("shake");
  }
}

function setAuthMode(mode) {
  state.authMode = mode;
  $$(".tab[data-mode]").forEach((t) => t.classList.toggle("is-active", t.dataset.mode === mode));
  $("#auth-submit").textContent = mode === "login" ? "Sign in" : "Create account";
  $("#auth-pass").autocomplete = mode === "login" ? "current-password" : "new-password";
  renderAuthError("");
}

async function enterApp(user) {
  state.user = user;
  if (typeof toggleProfileDropdown === "function") toggleProfileDropdown(false);
  $("#who-name").textContent = user.username;
  $("#who-role").textContent = `${user.role} account`;
  $("#who-avatar").textContent = user.username.slice(0, 1).toUpperCase();
  const isAdmin = user.role === "admin";
  const topbar = $("#topbar");
  if (topbar) topbar.hidden = false;
  $("#nav").hidden = $("#whoami").hidden = $("#cmd-trigger").hidden = false;
  if ($("#btn-shortcuts-help")) $("#btn-shortcuts-help").hidden = false;
  if ($("#btn-theme-toggle")) $("#btn-theme-toggle").hidden = false;
  $("#nav-admin").hidden = $("#log-user").hidden = !isAdmin;

  // Immediately render workbench so refresh and login feel instantaneous
  showView("workbench");
  if (typeof toggleProfileDropdown === "function") toggleProfileDropdown(false);

  // Fetch user-custom grammar & filters in parallel
  try {
    const [gram] = await Promise.all([
      Api.get("/api/grammar"),
      isAdmin ? fillUserFilter().catch(() => {}) : Promise.resolve()
    ]);
    if (gram) setGrammar(gram, true);
  } catch (err) {
    console.warn("Background grammar load:", err);
  }
}

function leaveApp(message) {
  Api.setToken("");
  state.user = null;
  const topbar = $("#topbar");
  if (topbar) topbar.hidden = true;
  $("#nav").hidden = $("#whoami").hidden = $("#cmd-trigger").hidden = true;
  if ($("#btn-shortcuts-help")) $("#btn-shortcuts-help").hidden = true;
  if ($("#btn-theme-toggle")) $("#btn-theme-toggle").hidden = true;
  $("#nav-admin").hidden = $("#log-user").hidden = true;
  toggleProfileDropdown(false);
  closeGrammarDrawer();
  showView("auth");
  if (message) renderAuthError(message);
}

$("#auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const userField = $("#auth-user");
  const passField = $("#auth-pass");
  const username = userField.value.trim();
  const password = passField.value;

  // Immediate client-side validation for crisp user feedback
  if (!username) {
    renderAuthError("Please enter your username.");
    userField.focus();
    return;
  }
  if (username.length < 3) {
    renderAuthError("Username must be at least 3 characters long.");
    userField.focus();
    return;
  }
  if (!/^[A-Za-z0-9_.-]+$/.test(username)) {
    renderAuthError("Usernames can only contain letters, numbers, hyphens, dots, and underscores (no spaces).");
    userField.focus();
    return;
  }
  if (!password) {
    renderAuthError("Please enter your password.");
    passField.focus();
    return;
  }
  if (password.length < 6) {
    renderAuthError("Password must be at least 6 characters long.");
    passField.focus();
    return;
  }

  const btn = $("#auth-submit");
  btn.disabled = true;
  renderAuthError("");
  try {
    const remember = $("#auth-remember").checked;
    const res = await Api.post(`/api/auth/${state.authMode}`, {
      username,
      password,
      remember
    });
    Api.setToken(res.token, remember);
    remember ? localStorage.setItem("zs_user", res.user.username) : localStorage.removeItem("zs_user");
    passField.value = "";
    await enterApp(res.user);
  } catch (err) {
    renderAuthError(err.message, err.action, err.actionUser || username);
  } finally {
    btn.disabled = false;
  }
});

$$(".tab[data-mode]").forEach((t) => t.addEventListener("click", () => setAuthMode(t.dataset.mode)));

$("#pw-toggle").addEventListener("click", (e) => {
  const input = $("#auth-pass"), show = input.type === "password";
  input.type = show ? "text" : "password";
  e.currentTarget.textContent = show ? "Hide" : "Show";
  e.currentTarget.setAttribute("aria-pressed", String(show));
});

/* ---------- Interactive Compiler Syntax & AST Canvas for Auth Background ---------- */
(function initAuthCompilerCanvas() {
  const canvas = $("#auth-compiler-canvas");
  const authView = $("#auth-view");
  if (!canvas || !authView) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const COMPILER_DATA = [
    // AST Grammar Nodes
    { type: "AST", text: "<Program>", tag: "ROOT" },
    { type: "AST", text: "<StmtList>", tag: "BLOCK" },
    { type: "AST", text: "<VarDecl>", tag: "DECL" },
    { type: "AST", text: "<AssignStmt>", tag: "ASSIGN" },
    { type: "AST", text: "<WhenTrue>", tag: "BRANCH" },
    { type: "AST", text: "<ElseWay>", tag: "BRANCH" },
    { type: "AST", text: "<BinaryExpr>", tag: "EXPR" },
    { type: "AST", text: "<BeamOutput>", tag: "I/O" },
    { type: "AST", text: "<HaltNode>", tag: "TERM" },
    { type: "AST", text: "<Condition>", tag: "COND" },

    // Lexer Tokens
    { type: "LEX", text: "let", tag: "KEYWORD" },
    { type: "LEX", text: ":=", tag: "ASSIGN" },
    { type: "LEX", text: "whenTrue", tag: "KEYWORD" },
    { type: "LEX", text: "elseWay", tag: "KEYWORD" },
    { type: "LEX", text: "beam", tag: "KEYWORD" },
    { type: "LEX", text: "halt", tag: "KEYWORD" },
    { type: "LEX", text: "<<=", tag: "OP_LE" },
    { type: "LEX", text: "==", tag: "OP_EQ" },
    { type: "LEX", text: "!=", tag: "OP_NE" },
    { type: "LEX", text: ";", tag: "SEMI" },
    { type: "LEX", text: "TOK_IDENT", tag: "ID" },
    { type: "LEX", text: "TOK_INT", tag: "NUM" },

    // Intermediate Code / Quadruples (TAC)
    { type: "TAC", text: "t1 := 5", tag: "IR_QUAD" },
    { type: "TAC", text: "t2 := x <<= y", tag: "IR_QUAD" },
    { type: "TAC", text: "if_false t2 goto L1", tag: "IR_GOTO" },
    { type: "TAC", text: "quad[0]: (:=, 5, -, x)", tag: "QUAD" },
    { type: "TAC", text: "quad[1]: (<<=, x, y, t2)", tag: "QUAD" },
    { type: "TAC", text: "emit_tac(t1)", tag: "EMIT" },

    // Semantic & Types
    { type: "SEM", text: "symtab.lookup('x')", tag: "SCOPE" },
    { type: "SEM", text: "typecheck(whole)", tag: "SEMANTIC" },
    { type: "TYPE", text: "type: whole", tag: "TYPE_INT" },
    { type: "TYPE", text: "type: fraction", tag: "TYPE_FLOAT" },
    { type: "TYPE", text: "type: truth", tag: "TYPE_BOOL" },

    // Stages
    { type: "STAGE", text: "[01: LEXER]", tag: "PHASE 1" },
    { type: "STAGE", text: "[02: PARSER]", tag: "PHASE 2" },
    { type: "STAGE", text: "[03: SEMANTIC]", tag: "PHASE 3" },
    { type: "STAGE", text: "[04: ICG_TAC]", tag: "PHASE 4" },
    { type: "STAGE", text: "[05: CODEGEN]", tag: "PHASE 5" }
  ];

  let width = 0, height = 0;
  let dpr = window.devicePixelRatio || 1;
  let nodes = [];
  let trailParticles = [];
  let animId = null;

  const mouse = {
    x: -9999,
    y: -9999,
    active: false,
    prevX: -9999,
    prevY: -9999
  };

  // Get tight bounding boxes of individual text and card elements (no gigantic dead blocks)
  let cachedBoxes = null;
  function updateContentBoxes() {
    if (authView.hidden) return [];
    cachedBoxes = getContentBoxes();
    return cachedBoxes;
  }

  function getContentBoxes() {
    const canvasRect = canvas.getBoundingClientRect();
    const boxes = [];
    const pad = 8; // Clean 8px buffer around actual text elements

    // 1. Auth Card
    const card = authView.querySelector(".auth-card");
    if (card) {
      const cr = card.getBoundingClientRect();
      boxes.push({
        left: cr.left - canvasRect.left - pad,
        top: cr.top - canvasRect.top - pad,
        right: cr.right - canvasRect.left + pad,
        bottom: cr.bottom - canvasRect.top + pad
      });
    }

    // 2. Logo
    const logo = authView.querySelector(".hero-logo");
    if (logo) {
      const lr = logo.getBoundingClientRect();
      boxes.push({
        left: lr.left - canvasRect.left - pad,
        top: lr.top - canvasRect.top - pad,
        right: lr.right - canvasRect.left + pad,
        bottom: lr.bottom - canvasRect.top + pad
      });
    }

    // 3. Hero Heading (h1)
    const h1 = authView.querySelector(".auth-hero h1");
    if (h1) {
      const hr = h1.getBoundingClientRect();
      boxes.push({
        left: hr.left - canvasRect.left - pad,
        top: hr.top - canvasRect.top - pad,
        right: hr.right - canvasRect.left + pad,
        bottom: hr.bottom - canvasRect.top + pad
      });
    }

    // 4. Hero Lead Text (.lead)
    const lead = authView.querySelector(".auth-hero .lead");
    if (lead) {
      const lr = lead.getBoundingClientRect();
      boxes.push({
        left: lr.left - canvasRect.left - pad,
        top: lr.top - canvasRect.top - pad,
        right: lr.right - canvasRect.left + pad,
        bottom: lr.bottom - canvasRect.top + pad
      });
    }

    // 5. Hero Pipeline Preview (.hero-pipeline-preview)
    const pipeline = authView.querySelector(".hero-pipeline-preview");
    if (pipeline) {
      const pr = pipeline.getBoundingClientRect();
      boxes.push({
        left: pr.left - canvasRect.left - pad,
        top: pr.top - canvasRect.top - pad,
        right: pr.right - canvasRect.left + pad,
        bottom: pr.bottom - canvasRect.top + pad
      });
    }

    // 6. Hero Code Card (.hero-code-card)
    const codeCard = authView.querySelector(".hero-code-card");
    if (codeCard) {
      const ccr = codeCard.getBoundingClientRect();
      boxes.push({
        left: ccr.left - canvasRect.left - pad,
        top: ccr.top - canvasRect.top - pad,
        right: ccr.right - canvasRect.left + pad,
        bottom: ccr.bottom - canvasRect.top + pad
      });
    }

    return boxes;
  }

  // Smooth proximity factor from 0.0 (inside content) to 1.0 (in open background)
  // Uses smoothstep (cubic Hermite) with a clean 18px feather so elements fade seamlessly
  function getContentProximity(x, y, boxes, featherDist = 18) {
    if (!boxes || !boxes.length) return 1;
    let minDist = 99999;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      const dx = Math.max(0, b.left - x, x - b.right);
      const dy = Math.max(0, b.top - y, y - b.bottom);
      const dist = Math.hypot(dx, dy);
      if (dist < minDist) minDist = dist;
    }
    if (minDist <= 0) return 0;
    if (minDist >= featherDist) return 1;
    const t = minDist / featherDist;
    return t * t * (3 - 2 * t);
  }

  function spawnNode(item, boxes) {
    const cardEl = authView.querySelector(".auth-card");
    const codeEl = authView.querySelector(".hero-code-card") || authView.querySelector(".auth-hero");
    const canvasRect = canvas.getBoundingClientRect();

    const heroRight = codeEl ? codeEl.getBoundingClientRect().right - canvasRect.left : width * 0.46;
    const cardLeft = cardEl ? cardEl.getBoundingClientRect().left - canvasRect.left : width * 0.54;
    const heroLeft = codeEl ? codeEl.getBoundingClientRect().left - canvasRect.left : width * 0.08;
    const cardRight = cardEl ? cardEl.getBoundingClientRect().right - canvasRect.left : width * 0.92;

    for (let attempt = 0; attempt < 30; attempt++) {
      let x, y;
      const zoneChoice = Math.random();

      if (zoneChoice < 0.22) {
        // Zone 1: Top area across full width (top margin)
        x = 15 + Math.random() * (width - 30);
        y = 15 + Math.random() * 125;
      } else if (zoneChoice < 0.44) {
        // Zone 2: Bottom area across full width (bottom margin)
        x = 15 + Math.random() * (width - 30);
        y = Math.max(15, height - 130) + Math.random() * 115;
      } else if (zoneChoice < 0.62) {
        // Zone 3: Center aisle in between branding/hero and auth box
        const aisleMin = Math.max(20, heroRight + 8);
        const aisleMax = Math.min(width - 20, cardLeft - 8);
        const aisleW = Math.max(25, aisleMax - aisleMin);
        x = aisleMin + Math.random() * aisleW;
        y = 30 + Math.random() * (height - 60);
      } else if (zoneChoice < 0.81) {
        // Zone 4: Left side of screen
        const maxL = Math.max(30, heroLeft - 10);
        x = 15 + Math.random() * maxL;
        y = 20 + Math.random() * (height - 40);
      } else {
        // Zone 5: Right side of screen
        const minR = Math.min(width - 30, cardRight + 10);
        const spanR = Math.max(30, width - 15 - minR);
        x = minR + Math.random() * spanR;
        y = 20 + Math.random() * (height - 40);
      }

      if (getContentProximity(x, y, boxes, 14) > 0.25) {
        return {
          x,
          y,
          vx: (Math.random() - 0.5) * 0.20,
          vy: (Math.random() - 0.5) * 0.20,
          text: item.text,
          tag: item.tag,
          type: item.type,
          baseAlpha: 0.40 + Math.random() * 0.22,
          size: item.type === "AST" || item.type === "STAGE" ? 12.5 : 11.5,
          phase: Math.random() * Math.PI * 2,
          driftSpeed: 0.006 + Math.random() * 0.006,
          radius: Math.max(16, (item.text.length * 6.5) / 2)
        };
      }
    }

    return {
      x: 15 + Math.random() * (width - 30),
      y: Math.random() < 0.5 ? 15 + Math.random() * 80 : Math.max(15, height - 90) + Math.random() * 75,
      vx: (Math.random() - 0.5) * 0.20,
      vy: (Math.random() - 0.5) * 0.20,
      text: item.text,
      tag: item.tag,
      type: item.type,
      baseAlpha: 0.40 + Math.random() * 0.22,
      size: 11.5,
      phase: Math.random() * Math.PI * 2,
      driftSpeed: 0.006 + Math.random() * 0.006,
      radius: Math.max(16, (item.text.length * 6.5) / 2)
    };
  }

  function resize() {
    dpr = window.devicePixelRatio || 1;
    const rect = authView.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    if (width === 0 || height === 0) return;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const boxes = updateContentBoxes();
    const isMobile = width < 768 || ('ontouchstart' in window);
    const targetCount = isMobile ? Math.min(22, Math.max(14, Math.floor((width * height) / 30000))) : Math.min(64, Math.max(44, Math.floor((width * height) / 16000)));
    nodes = [];
    for (let i = 0; i < targetCount; i++) {
      const item = COMPILER_DATA[i % COMPILER_DATA.length];
      nodes.push(spawnNode(item, boxes));
    }
  }

  function addTrailParticle(x, y, boxes) {
    if (trailParticles.length > 25) return;
    if (getContentProximity(x, y, boxes, 16) < 0.25) return;
    const item = COMPILER_DATA[Math.floor(Math.random() * COMPILER_DATA.length)];
    trailParticles.push({
      x: x + (Math.random() - 0.5) * 20,
      y: y + (Math.random() - 0.5) * 20,
      vy: -0.5 - Math.random() * 0.3,
      vx: (Math.random() - 0.5) * 0.3,
      text: item.text,
      tag: item.tag,
      alpha: 0.85,
      life: 1,
      decay: 0.020 + Math.random() * 0.010,
      size: 11.5
    });
  }

  window.addEventListener("resize", () => {
    if (!authView.hidden) resize();
  });

  window.addEventListener("mousemove", (e) => {
    if (authView.hidden) {
      mouse.active = false;
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const nx = e.clientX - rect.left;
    const ny = e.clientY - rect.top;

    const dx = nx - mouse.prevX;
    const dy = ny - mouse.prevY;
    const speed = Math.hypot(dx, dy);

    mouse.x = nx;
    mouse.y = ny;
    mouse.active = true;

    const boxes = cachedBoxes || updateContentBoxes();
    if (speed > 6 && Math.random() < 0.45) {
      addTrailParticle(nx, ny, boxes);
    }
    mouse.prevX = nx;
    mouse.prevY = ny;

    startLoop();
  });

  document.addEventListener("mouseleave", () => {
    mouse.active = false;
  });

  function drawRoundedRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }

  let lastFrameTs = 0;
  const prefersReducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isLowEndDevice = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && animId) {
      cancelAnimationFrame(animId);
      animId = null;
    } else if (!document.hidden && !authView.hidden) {
      startLoop();
    }
  });

  function render(nowTs = 0) {
    if (authView.hidden || document.hidden || prefersReducedMotion) {
      if (animId) cancelAnimationFrame(animId);
      animId = null;
      return;
    }
    const isMobileCanvas = width < 768 || ("ontouchstart" in window) || isLowEndDevice;
    if (isMobileCanvas && nowTs - lastFrameTs < 33) {
      animId = requestAnimationFrame(render);
      return;
    }
    lastFrameTs = nowTs;

    const boxes = cachedBoxes || updateContentBoxes();

    ctx.clearRect(0, 0, width, height);

    // Smooth proximity of mouse to content (0 inside content, 1 in open background)
    const mouseProx = getContentProximity(mouse.x, mouse.y, boxes, 20);

    // 1. Seamless Ambient Cursor Spotlight & Grid (Zero hard cuts - naturally feathered)
    if (mouse.active && mouseProx > 0.02) {
      const spotRadius = 240;
      const spotGrad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, spotRadius);
      const sAlpha = mouseProx;
      spotGrad.addColorStop(0, `rgba(9, 9, 11, ${0.12 * sAlpha})`);
      spotGrad.addColorStop(0.35, `rgba(9, 9, 11, ${0.05 * sAlpha})`);
      spotGrad.addColorStop(0.75, `rgba(9, 9, 11, ${0.012 * sAlpha})`);
      spotGrad.addColorStop(1, "rgba(9, 9, 11, 0)");
      ctx.fillStyle = spotGrad;
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, spotRadius, 0, Math.PI * 2);
      ctx.fill();

      // Compiler syntax grid matrix under cursor (softly feathered at edges)
      const gridStep = 32;
      const startX = Math.floor((mouse.x - 180) / gridStep) * gridStep;
      const endX = mouse.x + 180;
      const startY = Math.floor((mouse.y - 180) / gridStep) * gridStep;
      const endY = mouse.y + 180;

      for (let gx = startX; gx <= endX; gx += gridStep) {
        for (let gy = startY; gy <= endY; gy += gridStep) {
          const d = Math.hypot(gx - mouse.x, gy - mouse.y);
          if (d < 170) {
            const ptProx = getContentProximity(gx, gy, boxes, 16);
            if (ptProx > 0.05) {
              const crossAlpha = (1 - d / 170) * 0.35 * sAlpha * ptProx;
              ctx.strokeStyle = `rgba(9, 9, 11, ${crossAlpha})`;
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(gx - 3.5, gy);
              ctx.lineTo(gx + 3.5, gy);
              ctx.moveTo(gx, gy - 3.5);
              ctx.lineTo(gx, gy + 3.5);
              ctx.stroke();
            }
          }
        }
      }
    }

    // 2. Inter-node soft collision resolution (elliptical capsule bounds tailored for text tokens)
    for (let i = 0; i < nodes.length; i++) {
      const n1 = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const n2 = nodes[j];
        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const rx = (n1.radius || 22) + (n2.radius || 22);
        const ry = 22;
        const normDist = Math.hypot(dx / rx, dy / ry);

        if (normDist > 0 && normDist < 1.0) {
          const overlap = 1.0 - normDist;
          const nx = (dx / rx) / normDist;
          const ny = (dy / ry) / normDist;

          // Soft position nudge to gracefully avoid overlapping
          const nudgeX = nx * overlap * rx * 0.035;
          const nudgeY = ny * overlap * ry * 0.035;
          n1.x -= nudgeX;
          n1.y -= nudgeY;
          n2.x += nudgeX;
          n2.y += nudgeY;

          // Very slight velocity deflection off each other's path
          const impulse = 0.010 * overlap;
          n1.vx -= nx * impulse;
          n1.vy -= ny * impulse;
          n2.vx += nx * impulse;
          n2.vy += ny * impulse;
        }
      }
    }

    // 3. Update and organize compiler nodes
    const influenceRadius = 230;
    const nearbyNodes = [];

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];

      // Smooth organic wave drift for calm, fluid floating
      n.phase = (n.phase || 0) + (n.driftSpeed || 0.008);
      const wobbleX = Math.cos(n.phase) * 0.045;
      const wobbleY = Math.sin(n.phase) * 0.045;

      n.x += n.vx + wobbleX;
      n.y += n.vy + wobbleY;

      // Soft velocity damping so collisions settle smoothly without jitter
      const currentSpeed = Math.hypot(n.vx, n.vy);
      if (currentSpeed > 0.22) {
        n.vx *= 0.985;
        n.vy *= 0.985;
      } else if (currentSpeed < 0.06) {
        n.vx += (Math.random() - 0.5) * 0.015;
        n.vy += (Math.random() - 0.5) * 0.015;
      }

      if (n.x < -45) n.x = width + 45;
      else if (n.x > width + 45) n.x = -45;
      if (n.y < -45) n.y = height + 45;
      else if (n.y > height + 45) n.y = -45;

      // Gentle steering away from content boxes so nodes stay naturally in open channels
      for (let j = 0; j < boxes.length; j++) {
        const b = boxes[j];
        const cx = (b.left + b.right) / 2;
        const cy = (b.top + b.bottom) / 2;
        if (n.x >= b.left - 12 && n.x <= b.right + 12 && n.y >= b.top - 12 && n.y <= b.bottom + 12) {
          const angle = Math.atan2(n.y - cy, n.x - cx);
          n.x += Math.cos(angle) * 0.7;
          n.y += Math.sin(angle) * 0.7;
          n.vx += Math.cos(angle) * 0.015;
          n.vy += Math.sin(angle) * 0.015;
        }
      }

      const nProx = getContentProximity(n.x, n.y, boxes, 16);
      if (nProx <= 0.03) continue; // Completely invisible inside content

      let dist = 9999;
      let intensity = 0;
      if (mouse.active && mouseProx > 0.05) {
        dist = Math.hypot(n.x - mouse.x, n.y - mouse.y);
        if (dist < influenceRadius) {
          intensity = (1 - dist / influenceRadius) * mouseProx * nProx;
          const pull = intensity * 12;
          const angle = Math.atan2(mouse.y - n.y, mouse.x - n.x);
          nearbyNodes.push({
            node: n,
            dist,
            intensity,
            prox: nProx,
            drawX: n.x + Math.cos(angle) * pull,
            drawY: n.y + Math.sin(angle) * pull
          });
        }
      }

      // Draw idle node when not actively highlighted
      if (intensity <= 0) {
        const drawAlpha = n.baseAlpha * nProx;
        ctx.font = `500 ${n.size}px "JetBrains Mono", monospace`;
        ctx.fillStyle = `rgba(9, 9, 11, ${drawAlpha})`;
        ctx.fillText(n.text, n.x, n.y);

        // Small solid black joint dot
        ctx.fillStyle = `rgba(9, 9, 11, ${Math.min(1, drawAlpha + 0.1)})`;
        ctx.beginPath();
        ctx.arc(n.x - 6, n.y - 4, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 3. Draw AST Branch Lines connecting cursor & nearby nodes (Crisp Black, Smoothly Blended)
    if (mouse.active && nearbyNodes.length > 0 && mouseProx > 0.08) {
      // Branch lines from cursor to nodes
      nearbyNodes.forEach(({ node, intensity, prox, drawX, drawY }) => {
        const lineAlpha = (0.35 + intensity * 0.55) * mouseProx * prox;
        ctx.strokeStyle = `rgba(9, 9, 11, ${lineAlpha})`;
        ctx.lineWidth = 1.5 + intensity * 0.7;
        ctx.beginPath();
        ctx.moveTo(mouse.x, mouse.y);
        ctx.lineTo(drawX - 6, drawY - 4);
        ctx.stroke();

        // Node joint dot on cursor connection
        ctx.fillStyle = `rgba(9, 9, 11, ${prox})`;
        ctx.beginPath();
        ctx.arc(drawX - 6, drawY - 4, 3 + intensity * 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Midpoint branch label
        if (intensity > 0.35 && prox > 0.6) {
          const midX = (mouse.x + drawX) / 2;
          const midY = (mouse.y + drawY) / 2;
          ctx.font = '600 9px "JetBrains Mono", monospace';
          ctx.fillStyle = `rgba(9, 9, 11, ${0.7 * intensity * prox})`;
          ctx.fillText("├─ " + (node.type.toLowerCase()), midX + 4, midY - 3);
        }
      });

      // Inter-node AST branch lines
      for (let i = 0; i < nearbyNodes.length; i++) {
        for (let j = i + 1; j < nearbyNodes.length; j++) {
          const p1 = nearbyNodes[i];
          const p2 = nearbyNodes[j];
          const d = Math.hypot(p1.drawX - p2.drawX, p1.drawY - p2.drawY);
          if (d < 130) {
            const lineAlpha = (1 - d / 130) * Math.min(p1.intensity, p2.intensity) * 0.6 * p1.prox * p2.prox;
            if (lineAlpha > 0.02) {
              ctx.strokeStyle = `rgba(9, 9, 11, ${lineAlpha})`;
              ctx.lineWidth = 1.2;
              ctx.beginPath();
              ctx.moveTo(p1.drawX - 6, p1.drawY - 4);
              ctx.lineTo(p2.drawX - 6, p2.drawY - 4);
              ctx.stroke();
            }
          }
        }
      }

      // Draw highlighted AST Node Badges
      nearbyNodes.forEach(({ node, intensity, prox, drawX, drawY }) => {
        ctx.font = '700 12px "JetBrains Mono", monospace';
        const textMetrics = ctx.measureText(node.text);
        const tagText = `[${node.tag}]`;
        ctx.font = '600 9.5px "JetBrains Mono", monospace';
        const tagMetrics = ctx.measureText(tagText);

        const padX = 10;
        const totalW = textMetrics.width + tagMetrics.width + padX * 2 + 8;
        const boxH = 25;
        const boxX = drawX - 6;
        const boxY = drawY - 18;
        const badgeAlpha = prox;

        if (intensity > 0.42) {
          // Solid Black Badge with Crisp White Text
          ctx.fillStyle = `rgba(9, 9, 11, ${0.96 * badgeAlpha})`;
          drawRoundedRect(ctx, boxX, boxY, totalW, boxH, 6);
          ctx.fill();

          ctx.strokeStyle = `rgba(9, 9, 11, ${badgeAlpha})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Tag
          ctx.font = '600 9.5px "JetBrains Mono", monospace';
          ctx.fillStyle = `rgba(161, 161, 170, ${badgeAlpha})`;
          ctx.fillText(tagText, boxX + padX, boxY + 16);

          // Text
          ctx.font = '700 12px "JetBrains Mono", monospace';
          ctx.fillStyle = `rgba(255, 255, 255, ${badgeAlpha})`;
          ctx.fillText(node.text, boxX + padX + tagMetrics.width + 6, boxY + 16.5);
        } else {
          // Crisp White Badge with Solid Black Border
          ctx.fillStyle = `rgba(255, 255, 255, ${0.94 * badgeAlpha})`;
          drawRoundedRect(ctx, boxX, boxY, totalW, boxH, 6);
          ctx.fill();

          ctx.strokeStyle = `rgba(9, 9, 11, ${(0.45 + intensity * 0.55) * badgeAlpha})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Tag
          ctx.font = '600 9.5px "JetBrains Mono", monospace';
          ctx.fillStyle = `rgba(9, 9, 11, ${(0.65 + intensity * 0.3) * badgeAlpha})`;
          ctx.fillText(tagText, boxX + padX, boxY + 16);

          // Text
          ctx.font = '700 12px "JetBrains Mono", monospace';
          ctx.fillStyle = `rgba(9, 9, 11, ${badgeAlpha})`;
          ctx.fillText(node.text, boxX + padX + tagMetrics.width + 6, boxY + 16.5);
        }
      });
    }

    // 4. Draw Compiler Cursor Scanner Reticle (Only when in open background)
    if (mouse.active && mouseProx > 0.15) {
      const reticleAlpha = mouseProx;
      ctx.strokeStyle = `rgba(9, 9, 11, ${0.85 * reticleAlpha})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = `rgba(9, 9, 11, ${reticleAlpha})`;
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(9, 9, 11, ${0.9 * reticleAlpha})`;
      ctx.lineWidth = 1.5;
      const ticks = [
        [mouse.x - 26, mouse.y, mouse.x - 14, mouse.y],
        [mouse.x + 14, mouse.y, mouse.x + 26, mouse.y],
        [mouse.x, mouse.y - 26, mouse.x, mouse.y - 14],
        [mouse.x, mouse.y + 14, mouse.x, mouse.y + 26],
      ];
      ctx.beginPath();
      ticks.forEach(([x1, y1, x2, y2]) => {
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      });
      ctx.stroke();

      ctx.fillStyle = `rgba(9, 9, 11, ${reticleAlpha})`;
      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.fillText("PARSE: SCANNING", mouse.x + 28, mouse.y - 8);

      ctx.fillStyle = `rgba(9, 9, 11, ${0.75 * reticleAlpha})`;
      ctx.font = '500 9px "JetBrains Mono", monospace';
      ctx.fillText(`AST_ROOT [X:${Math.round(mouse.x)} Y:${Math.round(mouse.y)}]`, mouse.x + 28, mouse.y + 6);
    }

    // 5. Update and draw floating compiler token trail particles
    for (let i = trailParticles.length - 1; i >= 0; i--) {
      const p = trailParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;

      if (p.life <= 0) {
        trailParticles.splice(i, 1);
        continue;
      }

      ctx.font = `700 ${p.size}px "JetBrains Mono", monospace`;
      ctx.fillStyle = `rgba(9, 9, 11, ${p.alpha * p.life})`;
      ctx.fillText(p.text, p.x, p.y);
    }

    animId = requestAnimationFrame(render);
  }

  function startLoop() {
    if (!animId && !authView.hidden) {
      if (width === 0 || height === 0) resize();
      animId = requestAnimationFrame(render);
    }
  }

  setTimeout(() => {
    if (!authView.hidden) {
      resize();
      startLoop();
    }
  }, 60);

  window._startAuthCompilerCanvas = () => {
    resize();
    startLoop();
  };
})();

$("#logout").addEventListener("click", async () => {
  try { await Api.post("/api/auth/logout"); } catch {}
  leaveApp();
});

$$(".nav-btn").forEach((b) => b.addEventListener("click", () => showView(b.dataset.view)));

/* ---------- Executive Profile Menu Dropdown (Idea 1) ---------- */
function toggleProfileDropdown(show) {
  const dropdown = $("#profile-dropdown");
  const btn = $("#profile-btn");
  if (!dropdown) return;
  const shouldOpen = show !== undefined ? Boolean(show) : dropdown.hidden;
  dropdown.hidden = !shouldOpen;
  if (btn) btn.setAttribute("aria-expanded", String(shouldOpen));
}

const profileBtn = $("#profile-btn");
const profileDropdown = $("#profile-dropdown");

if (profileBtn && profileDropdown) {
  // Ensure closed by default on initial load
  toggleProfileDropdown(false);

  profileBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleProfileDropdown();
  });

  // Capture phase listener ensures that clicking ANY button, link, or area outside the dropdown immediately closes it
  window.addEventListener("click", (e) => {
    if (!profileDropdown.hidden && !profileDropdown.contains(e.target) && !profileBtn.contains(e.target)) {
      toggleProfileDropdown(false);
    }
  }, true);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !profileDropdown.hidden) {
      toggleProfileDropdown(false);
      profileBtn.focus();
    }
  });

  profileDropdown.addEventListener("click", (e) => {
    const item = e.target.closest(".profile-dropdown-item");
    if (!item) return;
    toggleProfileDropdown(false);
    if (item.dataset.view) {
      showView(item.dataset.view);
    } else if (item.id === "menu-open-grammar") {
      openGrammarDrawer();
    }
  });
}

/* ---------- Grammar Configuration Slide-Over Sheet / Drawer (Idea 5) ---------- */
const grammarDrawer = $("#grammar-drawer");
const grammarDrawerBackdrop = $("#grammar-drawer-backdrop");
const btnOpenGrammar = $("#btn-open-grammar");
const btnCloseGrammarDrawer = $("#btn-close-grammar-drawer");

function openGrammarDrawer() {
  if (!grammarDrawer) return;
  grammarDrawer.hidden = false;
  if (grammarDrawerBackdrop) grammarDrawerBackdrop.hidden = false;
  requestAnimationFrame(() => {
    grammarDrawer.classList.add("is-open");
  });
  renderGrammar();
}

function closeGrammarDrawer() {
  if (!grammarDrawer) return;
  grammarDrawer.classList.remove("is-open");
  if (grammarDrawerBackdrop) grammarDrawerBackdrop.hidden = true;
  setTimeout(() => {
    if (!grammarDrawer.classList.contains("is-open")) {
      grammarDrawer.hidden = true;
    }
  }, 250);
}

if (btnOpenGrammar) btnOpenGrammar.addEventListener("click", openGrammarDrawer);
if (btnCloseGrammarDrawer) btnCloseGrammarDrawer.addEventListener("click", closeGrammarDrawer);
if (grammarDrawerBackdrop) grammarDrawerBackdrop.addEventListener("click", closeGrammarDrawer);

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && grammarDrawer && !grammarDrawer.hidden && grammarDrawer.classList.contains("is-open")) {
    closeGrammarDrawer();
  }
});

/* ---------- Language Grammar Panel ---------- */
function setGrammar(data, preserveDirtyDraft = false) {
  state.grammar = data;
  if (!preserveDirtyDraft || !state.grammarDraftDirty) {
    state.draft = JSON.parse(JSON.stringify(data.grammar));
    state.grammarDraftDirty = false;
  }
  renderGrammar();
}

function renderGrammar() {
  const body = $("#grammar-body"), tab = state.gtab;
  $$("[data-gtab]").forEach((t) => t.classList.toggle("is-active", t.dataset.gtab === tab));
  $("#grammar-save").hidden = $("#grammar-reset").hidden = tab === "rules";
  if (tab === "rules") {
    body.innerHTML = `
      <div class="grammar-rules-header">
        <span class="muted text-small">Formal language specification with current custom tokens</span>
        <button type="button" class="btn ghost small" id="btn-copy-bnf"><span data-icon="copy"></span> Copy BNF</button>
      </div>
      <pre class="code bnf-code-view">${esc(state.grammar.bnf)}</pre>
      <div class="grammar-rules-footer">
        <p class="muted text-small">Every statement ends with a semicolon <code>;</code>. Programs terminate with <code>halt;</code>. Comments: <code>// line</code> and <code>/~~ block ~~/</code> are ignored by the compiler.</p>
      </div>`;
    const btnCopy = $("#btn-copy-bnf");
    if (btnCopy) {
      btnCopy.addEventListener("click", () => {
        navigator.clipboard.writeText(state.grammar.bnf || "");
        toast("BNF rules copied to clipboard");
      });
    }
    return;
  }

  const groups = GRAMMAR_GROUPS[tab] || [];
  const rolesMap = tab === "keywords" ? state.grammar.keyword_roles : state.grammar.operator_roles;

  let cardIdx = 0;
  const groupsHtml = groups.map((grp) => {
    const cards = grp.roles.map((role) => {
      const meaning = rolesMap[role] || role;
      const val = state.draft[tab][role] ?? "";
      const delayStyle = `style="--card-i:${cardIdx++}"`;
      return `
        <div class="grammar-card" ${delayStyle}>
          <div class="grammar-card-info">
            <span class="grammar-role-badge">${esc(role)}</span>
            <label class="grammar-card-label" for="g-${role}" title="${esc(meaning)}">${esc(meaning)}</label>
          </div>
          <input class="grammar-card-input" id="g-${role}" data-role="${role}" value="${esc(val)}" spellcheck="false" autocomplete="off" placeholder="${esc(role)}">
        </div>`;
    }).join("");

    return `
      <div class="grammar-section">
        <div class="grammar-section-title">${esc(grp.title)}</div>
        <div class="grammar-cards-grid">${cards}</div>
      </div>`;
  }).join("");

  body.innerHTML = `${groupsHtml}<div id="grammar-problems"></div>`;

  function validateGrammarDraftLive() {
    const inputs = $$("input[data-role]", body);
    const counts = {};
    const otherTab = tab === "keywords" ? "operators" : "keywords";
    const otherVals = new Set(Object.values(state.draft[otherTab] || {}).map((v) => String(v || "").trim()).filter(Boolean));
    inputs.forEach((inp) => {
      const v = inp.value.trim();
      if (v) counts[v] = (counts[v] || 0) + 1;
    });
    let hasConflict = false;
    inputs.forEach((inp) => {
      const v = inp.value.trim();
      const role = inp.dataset.role;
      const isCommentClash = tab === "operators" && (v.includes("//") || v.includes("/~~") || v.includes("~~/") || v.includes("#~") || v.includes("~#"));
      const isInvalid = !v || counts[v] > 1 || otherVals.has(v) || isCommentClash ||
        (tab === "keywords" && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(v)) ||
        (tab === "operators" && role !== "CAST" && !/^[^\sA-Za-z0-9_\"'(){};.]{1,4}$/.test(v));
      inp.classList.toggle("is-conflict", isInvalid);
      const card = inp.closest(".grammar-card");
      if (card) card.classList.toggle("is-conflict", isInvalid);
      if (isInvalid) hasConflict = true;
    });
    return hasConflict;
  }

  validateGrammarDraftLive();
  if ($("#grammar-preview")) $("#grammar-preview").hidden = tab === "rules";

  $$("input[data-role]", body).forEach((i) => i.addEventListener("input", () => {
    state.draft[tab][i.dataset.role] = i.value.trim();
    state.grammarDraftDirty = true;
    const conflict = validateGrammarDraftLive();
    const msgEl = $("#grammar-msg");
    if (msgEl) {
      msgEl.textContent = conflict ? "Conflict or invalid token detected" : "Unsaved – runs use saved grammar";
      msgEl.className = "grammar-status-badge " + (conflict ? "is-bad" : "is-warn");
    }
  }));
}

$$("[data-gtab]").forEach((t) => t.addEventListener("click", () => {
  state.gtab = t.dataset.gtab;
  renderGrammar();
}));

if ($("#grammar-preview")) {
  $("#grammar-preview").addEventListener("click", () => {
    const baseSrc = SAMPLES[sample.value] || code.value;
    const defKw = ZS_DEFAULT_GRAMMAR.keywords;
    const defOp = ZS_DEFAULT_GRAMMAR.operators;
    const draftKw = (state.draft && state.draft.keywords) || defKw;
    const draftOp = (state.draft && state.draft.operators) || defOp;
    let previewSrc = baseSrc;
    for (const [role, defWord] of Object.entries(defKw)) {
      const customWord = draftKw[role] || defWord;
      if (customWord !== defWord) {
        previewSrc = previewSrc.replace(new RegExp("\\b" + zsEscRegex(defWord) + "\\b", "g"), customWord);
      }
    }
    for (const [role, defSym] of Object.entries(defOp)) {
      const customSym = draftOp[role] || defSym;
      if (customSym !== defSym) {
        previewSrc = previewSrc.split(defSym).join(customSym);
      }
    }
    code.value = previewSrc;
    updateGutter();
    toast("Translated sample with draft grammar tokens");
  });
}

$("#grammar-save").addEventListener("click", async () => {
  try {
    setGrammar(await Api.put("/api/grammar", {
      keywords: state.draft.keywords,
      operators: state.draft.operators
    }));
    state.grammarDraftDirty = false;
    $("#grammar-msg").textContent = "Saved · Active";
    $("#grammar-msg").className = "grammar-status-badge is-ok";
    toast("Grammar updated successfully");
    compileCache.clear();
    updateSyntaxHighlight();
  } catch (err) {
    const list = (err.problems || [err.message]).map((p) => `<li>${esc(p)}</li>`).join("");
    $("#grammar-problems").innerHTML = `<ul class="problems">${list}</ul>`;
  }
});

$("#grammar-reset").addEventListener("click", async () => {
  try {
    setGrammar(await Api.post("/api/grammar/reset"));
    state.grammarDraftDirty = false;
    $("#grammar-msg").textContent = "Default grammar active";
    $("#grammar-msg").className = "grammar-status-badge";
    compileCache.clear();
    updateSyntaxHighlight();
    toast("Grammar reset to default");
  } catch (err) {
    if (err.status === 401) return leaveApp(err.message);
    toast(err.message);
  }
});

/* ---------- Code Editor (Syntax Highlighting, Error Gutter, Autosave) ---------- */
const code = $("#code"), gutter = $("#gutter"), codeHighlight = $("#code-highlight");
let lastLineCount = -1;
let activeErrorLines = new Map(); // lineNum -> error message
let gutterTimer = null;
let autosaveTimer = null;

function highlightZynoScript(src, errorLinesMap) {
  const g = zsNormalizeGrammar((state.grammar && state.grammar.grammar) ? state.grammar.grammar : ZS_DEFAULT_GRAMMAR);
  const kwMap = {};
  for (const [role, word] of Object.entries(g.keywords)) kwMap[word] = role;
  const ops = Object.values(g.operators).filter((o) => typeof o === "string" && o.length > 0).sort((a, b) => b.length - a.length);
  const opParts = ops.map((o) => {
    let e = zsEscRegex(o);
    if (/^[A-Za-z_]/.test(o)) e = "\\b" + e;
    if (/[A-Za-z0-9_]$/.test(o)) e = e + "\\b";
    return e;
  });
  const opRx = opParts.join("|");
  const tokenRx = new RegExp(
    `(\\/~~[\\s\\S]*?~~\\/|#~[\\s\\S]*?~#|\\/\\/[^\\n]*)|("[^"\\n]*"|'[^'\\n]')|(\\b\\d+\\.\\d+\\b|\\b\\d+\\b)|(${opRx})|(\\b[A-Za-z_]\\w*\\b)`,
    "g"
  );

  let out = "";
  let lastIdx = 0;
  let m;
  while ((m = tokenRx.exec(src)) !== null) {
    if (m.index > lastIdx) out += esc(src.slice(lastIdx, m.index));
    const tok = m[0];
    if (m[1] !== undefined) {
      // Preserve line breaks inside multi-line block comments so per-line wrapping stays aligned
      out += tok.split("\n").map((seg) => `<span class="hl-com">${esc(seg)}</span>`).join("\n");
    } else if (m[2] !== undefined) {
      out += `<span class="hl-str">${esc(tok)}</span>`;
    } else if (m[3] !== undefined) {
      out += `<span class="hl-num">${esc(tok)}</span>`;
    } else if (m[4] !== undefined) {
      out += `<span class="hl-op">${esc(tok)}</span>`;
    } else if (m[5] !== undefined && tok in kwMap) {
      const r = kwMap[tok];
      const cls = r in ZS_TYPE_OF_ROLE ? "hl-type" : (r === "TRUE" || r === "FALSE" ? "hl-bool" : "hl-kw");
      out += `<span class="${cls}">${esc(tok)}</span>`;
    } else {
      out += esc(tok);
    }
    lastIdx = m.index + tok.length;
  }
  if (lastIdx < src.length) out += esc(src.slice(lastIdx));

  if (errorLinesMap && errorLinesMap.size > 0) {
    out = out.split("\n").map((lineHtml, idx) => {
      const ln = idx + 1;
      return errorLinesMap.has(ln) ? `<span class="hl-err-line">${lineHtml || " "}</span>` : lineHtml;
    }).join("\n");
  }
  return out + (src.endsWith("\n") ? " " : "");
}

function updateSyntaxHighlight() {
  if (!codeHighlight) return;
  codeHighlight.innerHTML = highlightZynoScript(code.value, activeErrorLines);
}

function renderGutterNow(force = false) {
  const n = code.value.split("\n").length;
  $("#code-stats").textContent = `${n} line${n > 1 ? "s" : ""} · ${code.value.length} chars`;
  if (!force && n === lastLineCount && activeErrorLines.size === 0) return;
  lastLineCount = n;
  const rows = [];
  for (let i = 1; i <= n; i++) {
    const errMsg = activeErrorLines.get(i);
    if (errMsg) {
      rows.push(`<span class="gutter-line is-error" data-line="${i}" title="Line ${i}: ${esc(errMsg)}">${i}</span>`);
    } else {
      rows.push(`<span class="gutter-line">${i}</span>`);
    }
  }
  gutter.innerHTML = rows.join("");
}

function setEditorErrors(errs) {
  activeErrorLines.clear();
  if (Array.isArray(errs)) {
    for (const e of errs) {
      if (e && e.line && !activeErrorLines.has(e.line)) {
        activeErrorLines.set(e.line, e.message || "Error");
      }
    }
  }
  renderGutterNow(true);
  updateSyntaxHighlight();
}

function updateGutter() {
  updateSyntaxHighlight();
  const n = code.value.split("\n").length;
  $("#code-stats").textContent = `${n} line${n > 1 ? "s" : ""} · ${code.value.length} chars`;
  if (n !== lastLineCount) {
    clearTimeout(gutterTimer);
    gutterTimer = setTimeout(() => renderGutterNow(true), 16);
  }
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    try {
      localStorage.setItem("zs_autosave_code", code.value);
      localStorage.setItem("zs_autosave_sample", sample.value);
    } catch {}
  }, 250);
}

gutter.addEventListener("click", (e) => {
  const ln = e.target.closest(".gutter-line[data-line]");
  if (ln) jumpToLine(+ln.dataset.line);
});

code.addEventListener("input", () => {
  if (activeErrorLines.size > 0) {
    activeErrorLines.clear();
    renderGutterNow(true);
  }
  updateGutter();
});
code.addEventListener("scroll", () => {
  gutter.scrollTop = code.scrollTop;
  if (codeHighlight) {
    codeHighlight.scrollTop = code.scrollTop;
    codeHighlight.scrollLeft = code.scrollLeft;
  }
});
code.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    runStage("output");
    return;
  }
  if (e.key !== "Tab") return;
  e.preventDefault();
  code.setRangeText("    ", code.selectionStart, code.selectionEnd, "end");
  updateGutter();
});

const sample = $("#sample");
sample.innerHTML = Object.keys(SAMPLES).map((k) => `<option>${esc(k)}</option>`).join("");
enhanceSelect(sample);
sample.addEventListener("change", () => {
  code.value = SAMPLES[sample.value];
  activeErrorLines.clear();
  renderGutterNow(true);
  updateGutter();
  resetStates();
  toast(`Loaded "${sample.value}"`);
});

// Restore autosaved code or default sample
(function initEditorContent() {
  const savedSample = localStorage.getItem("zs_autosave_sample");
  const savedCode = localStorage.getItem("zs_autosave_code");
  if (savedSample && SAMPLES[savedSample]) {
    sample.value = savedSample;
  }
  code.value = (savedCode && savedCode.trim().length > 0) ? savedCode : SAMPLES[sample.value];
  renderGutterNow(true);
  updateSyntaxHighlight();
})();

const btnRunEditor = $("#btn-run-editor");
if (btnRunEditor) {
  btnRunEditor.addEventListener("click", () => runStage("output"));
}

function jumpToLine(line) {
  const lines = code.value.split("\n");
  const start = lines.slice(0, line - 1).reduce((n, l) => n + l.length + 1, 0);
  if (typeof switchMobileWorkbenchPane === "function") switchMobileWorkbenchPane("editor");
  code.focus();
  code.setSelectionRange(start, start + (lines[line - 1] || "").length);
  const lineHeight = parseFloat(getComputedStyle(code).lineHeight) || 21;
  code.scrollTop = Math.max(0, (line - 4) * lineHeight);
  const editorBox = $("#code-editor-box");
  if (editorBox) {
    editorBox.classList.remove("line-shake");
    void editorBox.offsetWidth;
    editorBox.classList.add("line-shake");
  }
}

/* ---------- Compiler Pipeline Stages ---------- */
function setState(stage, value) {
  const el = $(`.stage[data-stage="${stage}"]`);
  if (el) el.dataset.state = value;
}

function resetStates() {
  STAGES.forEach((s) => setState(s, "idle"));
}

async function runStage(stage) {
  state.selected = stage;
  $$(".stage").forEach((b) => b.classList.toggle("is-selected", b.dataset.stage === stage));
  resetStates();
  const upto = STAGES.indexOf(stage);
  STAGES.forEach((s, i) => {
    if (i <= upto) setState(s, "running");
  });
  $$(".stage, #run-all, #btn-run-editor").forEach((b) => (b.disabled = true));
  const runBtn = $("#btn-run-editor");
  const runAllBtn = $("#run-all");
  if (runBtn) runBtn.classList.add("is-running");
  if (runAllBtn) runAllBtn.classList.add("is-running");
  const activeGrammarObj = (state.grammar && state.grammar.grammar) ? state.grammar.grammar : ZS_DEFAULT_GRAMMAR;
  const cacheKey = `${stage}::${JSON.stringify(activeGrammarObj)}::${code.value}`;
  if (compileCache.has(cacheKey)) {
    const cachedRes = compileCache.get(cacheKey);
    state.lastResults = cachedRes;
    animateStageRipple(upto, cachedRes);
    renderOutput(stage, cachedRes);
    $$(".stage, #run-all, #btn-run-editor").forEach((b) => {
      b.disabled = false;
      b.classList.remove("is-running");
    });
    return;
  }

  try {
    if (code.value.length <= 10000 && typeof compileLocal === "function") {
      const activeGrammar = (state.grammar && state.grammar.grammar) ? state.grammar.grammar : ZS_DEFAULT_GRAMMAR;
      const res = compileLocal(stage, code.value, activeGrammar);
      compileCache.set(cacheKey, res);
      if (compileCache.size > 50) compileCache.delete(compileCache.keys().next().value);
      state.lastResults = res;
      animateStageRipple(upto, res);
      renderOutput(stage, res);
      Api.post(`/api/compile/${stage}`, { source: code.value }).catch(() => {});
      return;
    }
    const res = await Api.post(`/api/compile/${stage}`, { source: code.value });
    compileCache.set(cacheKey, res);
    if (compileCache.size > 50) compileCache.delete(compileCache.keys().next().value);
    state.lastResults = res;
    animateStageRipple(upto, res);
    renderOutput(stage, res);
  } catch (err) {
    resetStates();
    if (err.status === 401) return leaveApp(err.message);
    $("#output").innerHTML = `<p class="form-error">${esc(err.message)}</p>`;
  } finally {
    $$(".stage, #run-all, #btn-run-editor").forEach((b) => {
      b.disabled = false;
      b.classList.remove("is-running");
    });
  }
}

$$(".stage").forEach((b) => b.addEventListener("click", () => runStage(b.dataset.stage)));
$("#run-all").addEventListener("click", () => runStage("output"));

/* ---------- Output Inspector Rendering ---------- */
const errorList = (errs) => !errs.length ? "" : `<ul class="errors">${errs.map((e, i) =>
  `<li style="--i:${i}"><button type="button" data-line="${e.line}">` +
  `<span class="err-left"><span class="err-dot" aria-hidden="true"></span><span class="where">Line ${e.line}${e.col ? ":" + e.col : ""}${e.rule ? " · Rule " + e.rule : ""}</span><span class="err-msg">${esc(e.message)}</span></span>` +
  `<span class="err-jump" aria-hidden="true">Jump &rarr;</span>` +
  `</button></li>`).join("")}</ul>`;

const okBanner = (text) => `<div class="success">${icon("check")}<span>${text}</span></div>`;

const table = (heads, rows, mono = []) => `<div class="tbl-wrap"><table class="tbl"><thead><tr>${heads.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${
  rows.map((r) => `<tr>${r.map((c, i) => `<td class="${mono.includes(i) ? "m" : ""}">${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;

const RENDER = {
  lexical: (r) => {
    const tab = state.lexTab || "tokens";
    const subtabs = `<div class="subtabs-bar">
      <button class="subtab-btn ${tab === 'tokens' ? 'is-active' : ''}" data-lextab="tokens">Tokens (${r.count})</button>
      <button class="subtab-btn ${tab === 'identifiers' ? 'is-active' : ''}" data-lextab="identifiers">Identifiers (${r.identifiers.length})</button>
      <button class="subtab-btn ${tab === 'lines' ? 'is-active' : ''}" data-lextab="lines">By Line</button>
      <button class="subtab-btn ${tab === 'categories' ? 'is-active' : ''}" data-lextab="categories">Categories (${r.categories.length})</button>
    </div>`;

    let content = "";
    if (tab === "tokens") {
      content = r.tokens.length
        ? table(["Line", "Col", "Lexeme", "Category"], r.tokens.map((t) => [t.line, t.col, t.lexeme, t.category]), [2])
        : `<p class="empty text-muted">No tokens generated.</p>`;
    } else if (tab === "identifiers") {
      content = r.identifiers.length
        ? table(["Identifier", "First Line", "Count"], r.identifiers.map((i) => [i.name, i.first_line, i.count]), [0])
        : `<p class="empty text-muted">No identifiers found in source.</p>`;
    } else if (tab === "lines") {
      content = table(["Line", "Source Text", "Tokens"], r.lines.map((l) => [l.line, l.text || "(empty)", l.tokens.map((t) => t.lexeme).join("  ") || "-"]), [1]);
    } else if (tab === "categories") {
      content = table(["Category", "Count", "Lexemes Used"], r.categories.map((c) => [c.category, c.count, c.lexemes.join("  ")]), [2]);
    }

    return (r.ok ? okBanner(`${r.count} tokens identified · No lexical errors`) : `<h3>${r.errors.length} Lexical Error(s)</h3>`) +
      errorList(r.errors) + subtabs + content;
  },

  syntax: (r) => r.ok
    ? okBanner("Syntax verified · Parse tree generated successfully") + `<h3>Abstract Syntax Tree (AST)</h3><pre class="tree">${esc(r.tree)}</pre>`
    : `<h3>Syntax Error</h3>` + errorList(r.errors),

  semantic: (r) => {
    return (r.ok ? okBanner("Semantic check passed · All type and scope rules validated") : `<h3>${r.errors.length} Semantic Error(s)</h3>`) +
      errorList(r.errors) +
      `<h3>Symbol Table</h3>` + (r.symbols.length ? table(["Variable", "Type", "Declared Line"], r.symbols.map((s) => [s.name, s.type, s.line]), [0, 1]) : `<p class="empty text-muted">No variable declarations found.</p>`);
  },

  output: (r) => {
    return (r.ok ? okBanner(`Execution finished in ${r.steps} step(s)`) : `<h3>Runtime Error</h3>` + errorList(r.errors)) +
      `<h3>Program Console (Printed Lines)</h3><pre class="console">${esc(r.output.length ? r.output.join("\n") : "(no output produced)")}</pre>` +
      `<h3>Final Variable State</h3>` + (r.variables.length ? table(["Variable", "Value"], r.variables.map((v) => [v.name, v.value]), [1]) : `<p class="empty text-muted">No active variables.</p>`);
  },

  icg: (r) => {
    const tab = state.icgTab || "tac";
    const subtabs = `<div class="subtabs-bar">
      <button class="subtab-btn ${tab === 'tac' ? 'is-active' : ''}" data-icgtab="tac">Three-Address Code (TAC)</button>
      <button class="subtab-btn ${tab === 'quads' ? 'is-active' : ''}" data-icgtab="quads">Quadruples Table (${r.quads.length})</button>
    </div>`;

    const content = tab === "tac"
      ? `<pre class="code">${esc(r.tac.join("\n"))}</pre>`
      : table(["#", "Operator", "Arg 1", "Arg 2", "Result"], r.quads.map((q, i) => [i, q.op, q.arg1, q.arg2, q.result]), [1, 2, 3, 4]);

    return okBanner("Intermediate code generated") + subtabs + content;
  },
};

function animateStageRipple(uptoIdx, res) {
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  STAGES.forEach((s, i) => {
    const stateVal = i > uptoIdx ? "idle" : res.results[s] ? (res.results[s].ok ? "ok" : "errors") : "blocked";
    setState(s, stateVal);
    const el = $(`.stage[data-stage="${s}"]`);
    if (!el) return;
    el.classList.remove("stage-pulse");
    if (!reduceMotion && i <= uptoIdx && stateVal === "ok") {
      setTimeout(() => {
        el.classList.add("stage-pulse");
      }, i * 55);
    }
  });
}

function renderOutput(stage, res) {
  const shown = res.results[stage] ? stage : res.blocked_by;
  const r = res.results[shown];
  setEditorErrors(r.ok ? [] : r.errors);
  if (!r.ok && r.errors && r.errors.length) {
    const editorBox = $("#code-editor-box");
    if (editorBox) {
      editorBox.classList.remove("line-shake");
      void editorBox.offsetWidth;
      editorBox.classList.add("line-shake");
    }
  }
  $("#out-title").textContent = STAGE_TITLE[shown];
  const badge = $("#out-status");
  badge.hidden = false;
  badge.className = "badge " + (r.ok ? "ok" : "bad");
  badge.textContent = r.ok ? "Passed" : `${r.errors.length} error${r.errors.length > 1 ? "s" : ""}`;
  const notice = shown !== stage ? `<div class="notice"><span>${STAGE_TITLE[stage]} blocked by errors in ${STAGE_TITLE[shown]}. Resolve them to continue.</span></div>` : "";
  const outputEl = $("#output");
  outputEl.innerHTML = `<div class="out-anim">${notice}${RENDER[shown](r)}</div>`;
  if (shown === "output" && r.ok && r.output && r.output.length > 0 && r.output.length <= 12) {
    const consoleEl = outputEl.querySelector("pre.console");
    const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (consoleEl && !reduceMotion) {
      consoleEl.innerHTML = r.output.map((lineText, idx) =>
        `<span class="console-line-reveal" style="--line-i:${idx}">${esc(lineText)}</span>`
      ).join("\n");
    }
  }
  if (window.innerWidth <= 640 && typeof switchMobileWorkbenchPane === "function") {
    switchMobileWorkbenchPane("inspector");
  }
  if (typeof hydrateIcons === "function") hydrateIcons(outputEl);

  // Jump to code line on error click
  $$("button[data-line]", outputEl).forEach((b) => b.addEventListener("click", () => jumpToLine(+b.dataset.line)));

  // Sub-tabs for lexical
  $$("[data-lextab]", outputEl).forEach((b) => b.addEventListener("click", () => {
    state.lexTab = b.dataset.lextab;
    renderOutput(stage, res);
  }));

  // Sub-tabs for ICG
  $$("[data-icgtab]", outputEl).forEach((b) => b.addEventListener("click", () => {
    state.icgTab = b.dataset.icgtab;
    renderOutput(stage, res);
  }));

  // Contextual controls: Show Copy and Clear only when results exist (Idea 4)
  if (btnCopyOutput) btnCopyOutput.hidden = false;
  if (btnClearOutput) btnClearOutput.hidden = false;
}

// Copy output tool
const btnCopyOutput = $("#btn-copy-output");
if (btnCopyOutput) {
  btnCopyOutput.addEventListener("click", () => {
    const text = $("#output").innerText;
    if (!text || text.includes("Pick a compiler stage")) return toast("No output to copy");
    navigator.clipboard.writeText(text).then(() => toast("Output copied to clipboard"));
  });
}

// Clear output tool
const btnClearOutput = $("#btn-clear-output");
if (btnClearOutput) {
  btnClearOutput.addEventListener("click", () => {
    resetStates();
    $("#out-title").textContent = "Compiler Output";
    $("#out-status").hidden = true;
    btnClearOutput.hidden = true;
    if (btnCopyOutput) btnCopyOutput.hidden = true;
    $("#output").innerHTML = `<div class="empty-state out-anim">
      <div class="empty-glyph">${icon("braces")}</div>
      <p>Pick a compiler stage above or hit <b>Run All</b> to analyze and run your code.</p>
    </div>`;
  });
}

/* ---------- Activity Stream (Feed-Style Audit Trail - Idea 6) ---------- */
$("#log-filter").innerHTML += ACTIONS.map((a) => `<option value="${a}">${a.replace(/_/g, " ")}</option>`).join("");
enhanceSelect($("#log-filter"));
enhanceSelect($("#log-user"));

function timeAgo(dateInput) {
  if (!dateInput) return "";
  // The server stores UTC as "YYYY-MM-DD HH:MM:SS" with no zone; parse it as UTC, not local time.
  const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(dateInput) ? dateInput : dateInput.replace(" ", "T") + "Z";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return dateInput;
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 10) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return date.toLocaleDateString();
}

function formatActionPhrase(log) {
  const user = `<strong>${esc(log.username)}</strong>`;
  const act = log.action;
  const lines = log.program_size !== null && log.program_size !== undefined ? ` on <strong>${log.program_size} line${log.program_size === 1 ? '' : 's'}</strong>` : "";

  let actionText = "";
  if (act === "login") actionText = "signed in";
  else if (act === "logout") actionText = "signed out";
  else if (act === "register") actionText = "created an account";
  else if (act === "run_lexical") actionText = `ran <span class="feed-action-badge">Lexical Analysis</span>${lines}`;
  else if (act === "run_syntax") actionText = `ran <span class="feed-action-badge">Syntax Analysis</span>${lines}`;
  else if (act === "run_semantic") actionText = `ran <span class="feed-action-badge">Semantic Analysis</span>${lines}`;
  else if (act === "run_icg") actionText = `ran <span class="feed-action-badge">ICG</span>${lines}`;
  else if (act === "run_output") actionText = `ran <span class="feed-action-badge">Output Engine</span>${lines}`;
  else if (act === "grammar_update") actionText = "updated language grammar configuration";
  else if (act === "grammar_reset") actionText = "reset language grammar to default";
  else if (act.startsWith("admin_")) actionText = `performed admin action: <span class="feed-action-badge">${esc(act.replace("admin_", "").replace(/_/g, " "))}</span>`;
  else actionText = `performed <span class="feed-action-badge">${esc(act.replace(/_/g, " "))}</span>${lines}`;

  return `${user} ${actionText}`;
}

async function loadLogs() {
  const action = $("#log-filter").value, who = $("#log-user").value;
  const status = $("#log-status") ? $("#log-status").value : "";
  try {
    let url = "/api/logs?limit=300";
    if (action) url += "&action=" + encodeURIComponent(action);
    if (who) url += "&username=" + encodeURIComponent(who);
    if (status) url += "&status=" + encodeURIComponent(status);
    const res = await Api.get(url);
    $("#log-scope").textContent = res.scope === "everyone"
      ? (who ? `Showing telemetry filtered to user: ${who}` : "Showing telemetry across all users")
      : "Showing your account history";
    
    if (!res.logs || !res.logs.length) {
      $("#log-body").innerHTML = `<div class="empty-state" style="padding:48px 20px">
        <div class="empty-glyph">${icon("activity")}</div>
        <p>No activity recorded yet.</p>
      </div>`;
      return;
    }

    const itemsHtml = res.logs.map((l, idx) => {
      const isOk = l.status === "ok";
      const shortHash = l.program_hash ? l.program_hash.slice(0, 7) : "";
      const time = timeAgo(l.created_at);

      return `
        <div class="feed-item" style="--i:${Math.min(idx, 14)}" tabindex="0" role="button" aria-expanded="false">
          <div class="feed-left">
            <span class="feed-dot ${isOk ? 'ok' : 'error'}" title="${isOk ? 'Success' : 'Error'}"></span>
            <div class="feed-content">
              <div class="feed-summary">${formatActionPhrase(l)}</div>
              <div class="feed-time" title="${esc(l.created_at)}">${time} · ${esc(l.created_at)}</div>
            </div>
          </div>
          <div class="feed-right">
            ${shortHash ? `<span class="feed-hash" title="Program hash: ${esc(l.program_hash)}">#${shortHash}</span>` : ''}
            <span class="feed-chevron" aria-hidden="true">${icon("chevron")}</span>
          </div>
          <div class="feed-details" hidden>
            <div class="feed-detail-row">
              <span class="feed-detail-label">Full Timestamp:</span>
              <span class="feed-detail-value">${esc(l.created_at)}</span>
            </div>
            <div class="feed-detail-row">
              <span class="feed-detail-label">Status:</span>
              <span class="feed-detail-value ${isOk ? 'status-ok' : 'status-error'}">${esc(l.status.toUpperCase())}</span>
            </div>
            ${l.program_hash ? `
            <div class="feed-detail-row">
              <span class="feed-detail-label">Program Hash:</span>
              <span class="feed-detail-value">${esc(l.program_hash)}</span>
            </div>
            ` : ''}
            ${l.detail ? `
            <div class="feed-detail-row">
              <span class="feed-detail-label">Details:</span>
              <span class="feed-detail-value">${esc(l.detail)}</span>
            </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join("");

    $("#log-body").innerHTML = `<div class="activity-feed">${itemsHtml}</div>`;

    // Click to expand/collapse details
    $$(".feed-item", $("#log-body")).forEach((item) => {
      const toggle = () => {
        const details = $(".feed-details", item);
        if (!details) return;
        const expanded = item.classList.toggle("is-expanded");
        details.hidden = !expanded;
        item.setAttribute("aria-expanded", String(expanded));
      };

      item.addEventListener("click", toggle);
      item.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      });
    });

  } catch (err) {
    if (err.status === 401) leaveApp(err.message);
  }
}

$("#log-filter").addEventListener("change", loadLogs);
$("#log-user").addEventListener("change", loadLogs);
if ($("#log-status")) $("#log-status").addEventListener("change", loadLogs);
$("#log-refresh").addEventListener("click", loadLogs);

const btnLogExport = $("#log-export-btn");
if (btnLogExport) {
  btnLogExport.addEventListener("click", async () => {
    try {
      const action = $("#log-filter").value, who = $("#log-user").value, status = $("#log-status") ? $("#log-status").value : "";
      let url = "/api/logs?limit=1000";
      if (action) url += "&action=" + encodeURIComponent(action);
      if (who) url += "&username=" + encodeURIComponent(who);
      if (status) url += "&status=" + encodeURIComponent(status);
      const res = await Api.get(url);
      const dataStr = JSON.stringify(res.logs || [], null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `zynoscript_telemetry_${who || "all"}_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast("Exported activity telemetry as JSON");
    } catch (err) {
      toast("Export failed: " + err.message);
    }
  });
}


/* ---------- Language Guide ---------- */
function renderGuide() {
  if (!state.grammar) return;
  const g = state.grammar.grammar, kr = state.grammar.keyword_roles, or = state.grammar.operator_roles;
  const TYPES = ["INT", "FLOAT", "STRING", "BOOL", "CHAR"];
  const NORMAL_T = { INT: "int", FLOAT: "float", STRING: "str", BOOL: "bool", CHAR: "char" };
  const NORMAL_OP = { ASSIGN: "=", ADD: "+", SUB: "-", MUL: "*", DIV: "/", GT: ">", LT: "<", EQ: "==", NE: "!=", AND: "&&", OR: "||", NOT: "!" };
  const kw = Object.keys(kr).filter((r) => !TYPES.includes(r));
  $("#guide-keywords").innerHTML = table(["Purpose", "ZynoScript Keyword"], kw.map((r) => [kr[r], g.keywords[r]]), [1]);
  $("#guide-operators").innerHTML = table(["Purpose", "Standard Operator", "ZynoScript Operator"], Object.keys(or).map((r) => [or[r], NORMAL_OP[r] || "", g.operators[r]]), [1, 2]);
  $("#guide-types").innerHTML = table(["Type", "Standard Equivalent", "ZynoScript Keyword"], TYPES.map((r) => [kr[r].replace("Type: ", ""), NORMAL_T[r], g.keywords[r]]), [1, 2]);
  $("#guide-bnf").textContent = state.grammar.bnf;
  const k = g.keywords, o = g.operators;
  $("#gd-halt").textContent = `${k.HALT};`;
  $("#gd-decl1").textContent = `${k.LET} ${k.INT} a ${o.ASSIGN} 5;`;
  $("#gd-decl2").textContent = `${k.LET} x ${o.ASSIGN} 5;`;
  if ($("#gd-cast")) $("#gd-cast").textContent = `x ${o.CAST || "as~"} ${k.INT}`;
}

$("#guide-try").addEventListener("click", () => {
  sample.value = "Lab handout example";
  code.value = SAMPLES[sample.value];
  updateGutter();
  resetStates();
  showView("workbench");
  toast("Loaded handout example into editor");
});

/* ---------- Admin: User Management ---------- */
function ask({ title, text, password = false, confirm = "Confirm", danger = false }) {
  const d = $("#dlg"), input = $("#dlg-input");
  $("#dlg-title").textContent = title;
  $("#dlg-text").textContent = text;
  $("#dlg-field").hidden = !password;
  input.required = password;
  input.value = "";
  const ok = $("#dlg-ok");
  ok.textContent = confirm;
  ok.className = "btn " + (danger ? "danger" : "primary");
  d.showModal();
  return new Promise((resolve) => d.addEventListener("close", () => resolve(d.returnValue === "ok" ? (password ? input.value : true) : null), { once: true }));
}

async function fillUserFilter() {
  try {
    const res = await Api.get("/api/admin/users");
    if (!res || !res.users) return;
    const current = $("#log-user").value;
    const opts = `<option value="">All users</option>` + res.users.map((u) => `<option value="${esc(u.username)}">${esc(u.username)}</option>`).join("");
    $("#log-user").innerHTML = opts;
    if (current) $("#log-user").value = current;
    if ($("#log-user")._enhanced) $("#log-user")._enhanced.rebuild();
  } catch (err) {
    console.warn("Could not load users for filter:", err);
  }
}

let adminUsersCache = [];

async function loadTelemetry() {
  try {
    const res = await Api.get("/api/admin/telemetry");
    const t = res.telemetry;
    if (!t) return;
    if ($("#stat-total-users")) $("#stat-total-users").textContent = t.total_users;
    if ($("#stat-users-meta")) $("#stat-users-meta").textContent = `${t.admin_users} admin · ${t.regular_users} standard`;
    if ($("#stat-total-runs")) $("#stat-total-runs").textContent = t.total_runs;
    if ($("#stat-runs-meta")) $("#stat-runs-meta").textContent = `${t.success_rate_pct}% pass rate (${t.total_success} ok / ${t.total_errors} err)`;
    if ($("#stat-active-sessions")) $("#stat-active-sessions").textContent = t.active_sessions;
    if ($("#stat-db-type")) $("#stat-db-type").textContent = (t.db_backend || "").split(" ")[0] || "Active";
    if ($("#stat-db-meta")) $("#stat-db-meta").innerHTML = `<span class="live-dot ok"></span> ${esc(t.db_backend || "Connected")}`;

    const stageEl = $("#admin-stage-stats");
    if (stageEl) {
      const stageLabels = { lexical: "Lexical", syntax: "Syntax", semantic: "Semantic", icg: "ICG", output: "Output" };
      const pills = Object.entries(stageLabels).map(([key, label], idx) => {
        const cnt = (t.stages && t.stages[key]) || 0;
        return `<div class="stage-stat-pill">
          <span class="stage-stat-name"><span class="stage-num">0${idx + 1}</span> ${label}</span>
          <span class="stage-stat-count">${cnt} runs</span>
        </div>`;
      }).join("");
      stageEl.innerHTML = pills;
    }
  } catch (err) {
    console.warn("Telemetry fetch error:", err);
  }
}

function renderUsersTable() {
  const query = ($("#admin-user-search") ? $("#admin-user-search").value : "").trim().toLowerCase();
  const roleFilter = $("#admin-role-filter") ? $("#admin-role-filter").value : "";

  let filtered = adminUsersCache.filter((u) => {
    if (query && !u.username.toLowerCase().includes(query)) return false;
    if (roleFilter && u.role !== roleFilter) return false;
    return true;
  });

  if (!filtered.length) {
    $("#users-body").innerHTML = `<div class="empty-state" style="padding:32px 16px">
      <div class="empty-glyph">${icon("users")}</div>
      <p>${adminUsersCache.length === 0 ? "No registered users found." : "No users match your search."}</p>
    </div>`;
    return;
  }

  const rows = filtered.map((u) => {
    const me = u.id === state.user.id;
    const customGrammarBadge = u.has_custom_grammar
      ? `<span class="badge ok" title="User has customized keywords or operators">Custom</span>`
      : `<span class="badge" title="User uses default grammar">Default</span>`;

    return `<tr>
      <td><strong>${esc(u.username)}</strong>${me ? ' <span class="muted text-small">(you)</span>' : ""}</td>
      <td><span class="badge ${u.role === 'admin' ? 'ok' : ''}">${esc(u.role)}</span></td>
      <td class="mono text-muted text-small">${esc(u.created_at)}</td>
      <td class="mono"><strong>${u.runs}</strong></td>
      <td class="text-small">${esc(u.last_active || "never")}</td>
      <td>${customGrammarBadge}</td>
      <td>
        <div class="cell-actions">
          <button class="btn small ghost" data-act="view-logs" data-name="${esc(u.username)}" title="View ${esc(u.username)}'s activity stream">View Logs</button>
          <button class="btn small ghost" data-act="inspect-grammar" data-id="${u.id}" data-name="${esc(u.username)}" title="Inspect language grammar">Grammar</button>
          ${u.has_custom_grammar ? `<button class="btn small ghost" data-act="reset-grammar" data-id="${u.id}" data-name="${esc(u.username)}" title="Reset user grammar to default">Reset Grammar</button>` : ""}
          <button class="btn small" data-act="password" data-id="${u.id}" data-name="${esc(u.username)}">Reset Pwd</button>
          ${me ? "" : `
            <button class="btn small" data-act="role" data-id="${u.id}" data-name="${esc(u.username)}" data-target-role="${u.role === "admin" ? "user" : "admin"}">Make ${u.role === "admin" ? "user" : "admin"}</button>
            <button class="btn small danger" data-act="delete" data-id="${u.id}" data-name="${esc(u.username)}">Delete</button>
          `}
        </div>
      </td>
    </tr>`;
  }).join("");

  $("#users-body").innerHTML = `<table class="tbl"><thead><tr><th>User</th><th>Role</th><th>Registered (UTC)</th><th>Runs</th><th>Last Active</th><th>Grammar</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table>`;
}

async function loadUsers() {
  try {
    const { users } = await Api.get("/api/admin/users");
    adminUsersCache = users || [];
    renderUsersTable();
  } catch (err) {
    if (err.status === 401) leaveApp(err.message);
    else $("#users-body").innerHTML = `<p class="form-error" style="padding:16px">${esc(err.message)}</p>`;
  }
}

async function loadAdminDashboard() {
  await Promise.all([loadTelemetry(), loadUsers()]);
}

$("#users-body").addEventListener("click", async (e) => {
  const b = e.target.closest("button[data-act]");
  if (!b) return;
  const { act, id, name } = b.dataset;
  const role = b.dataset.targetRole || b.dataset.role;
  try {
    if (act === "view-logs") {
      showView("activity");
      $("#log-user").value = name;
      if ($("#log-user")._enhanced) $("#log-user")._enhanced.syncValue();
      loadLogs();
      toast(`Showing activity for ${name}`);
      return;
    } else if (act === "inspect-grammar") {
      const res = await Api.get(`/api/admin/users/${id}/grammar`);
      const dlg = $("#dlg-grammar");
      if (!dlg) return;
      $("#dlg-grammar-title").textContent = `${name}'s Language Grammar`;
      $("#dlg-grammar-sub").textContent = res.has_custom ? "Customized language keywords & operators" : "Using standard default ZynoScript grammar";
      const g = res.grammar;
      const kr = (state.grammar && state.grammar.keyword_roles) || {};
      const or = (state.grammar && state.grammar.operator_roles) || {};
      const kwRows = Object.entries(g.keywords || {}).map(([r, w]) => `<tr><td class="mono">${esc(r)}</td><td>${esc(kr[r] || "")}</td><td class="mono"><strong>${esc(w)}</strong></td></tr>`).join("");
      const opRows = Object.entries(g.operators || {}).map(([r, w]) => `<tr><td class="mono">${esc(r)}</td><td>${esc(or[r] || "")}</td><td class="mono"><strong>${esc(w)}</strong></td></tr>`).join("");
      $("#dlg-grammar-content").innerHTML = `
        <div class="card-panel">
          <header class="card-header"><h4>Keywords</h4></header>
          <table class="tbl"><thead><tr><th>Role</th><th>Description</th><th>Token</th></tr></thead><tbody>${kwRows}</tbody></table>
        </div>
        <div class="card-panel">
          <header class="card-header"><h4>Operators</h4></header>
          <table class="tbl"><thead><tr><th>Role</th><th>Description</th><th>Token</th></tr></thead><tbody>${opRows}</tbody></table>
        </div>
      `;
      dlg.showModal();
      return;
    } else if (act === "reset-grammar") {
      if (!(await ask({ title: `Reset grammar for ${name}?`, text: `Revert ${name}'s keywords and operators back to default ZynoScript specification.`, confirm: "Reset Grammar" }))) return;
      await Api.post(`/api/admin/users/${id}/grammar/reset`);
      toast(`Grammar reset to default for ${name}`);
      loadAdminDashboard();
      return;
    } else if (act === "password") {
      const pw = await ask({ title: "Reset Password", text: `Set a new password for ${name}. They will be logged out on all devices.`, password: true, confirm: "Reset Password" });
      if (pw === null) return;
      await Api.post(`/api/admin/users/${id}/password`, { password: pw });
      toast(`Password updated for ${name}`);
    } else if (act === "role") {
      if (!(await ask({ title: `Change role for ${name}?`, text: `Set ${name}'s role to ${role}.`, confirm: "Update Role" }))) return;
      await Api.post(`/api/admin/users/${id}/role`, { role });
      toast(`${name} is now ${role}`);
    } else if (act === "delete") {
      if (!(await ask({ title: `Delete user ${name}?`, text: "Their account and custom grammar will be permanently removed.", confirm: "Delete", danger: true }))) return;
      await Api.call("DELETE", `/api/admin/users/${id}`);
      toast(`${name} deleted`);
      fillUserFilter();
    }
    loadAdminDashboard();
  } catch (err) {
    toast(err.message);
  }
});

$("#users-refresh").addEventListener("click", loadAdminDashboard);

if ($("#admin-user-search")) $("#admin-user-search").addEventListener("input", renderUsersTable);
if ($("#admin-role-filter")) $("#admin-role-filter").addEventListener("change", renderUsersTable);

async function handlePrune(days, label) {
  if (!(await ask({ title: `Prune telemetry logs (${label})?`, text: `This will permanently delete activity logs ${days === 0 ? 'completely' : 'older than ' + days + ' days'}. Registered user accounts are retained.`, confirm: "Prune Logs", danger: true }))) return;
  try {
    const res = await Api.post("/api/admin/logs/prune", { days });
    toast(res.detail || "Logs pruned successfully");
    loadAdminDashboard();
    loadLogs();
  } catch (err) {
    toast(err.message);
  }
}

if ($("#btn-prune-7d")) $("#btn-prune-7d").addEventListener("click", () => handlePrune(7, "> 7 days"));
if ($("#btn-prune-30d")) $("#btn-prune-30d").addEventListener("click", () => handlePrune(30, "> 30 days"));
if ($("#btn-prune-all")) $("#btn-prune-all").addEventListener("click", () => handlePrune(0, "ALL logs"));


/* ---------- Application Start ---------- */
(async function start() {
  resetStates();
  enhanceSelect($("#sample"));
  enhanceSelect($("#log-filter"));
  enhanceSelect($("#log-user"));
  const savedUser = localStorage.getItem("zs_user");
  if (savedUser) {
    $("#auth-user").value = savedUser;
    $("#auth-remember").checked = true;
  }
  if (!Api.token) {
    fetch("/api/health", { method: "GET" }).catch(() => {});
    return showView("auth");
  }
  try {
    const me = await Api.get("/api/auth/me");
    await enterApp(me);
  } catch {
    leaveApp();
  }
})();

/* =========================================
   COMMAND PALETTE (Ctrl + K / Cmd + K)
   ========================================= */
const cmdPalette = $("#cmd-palette");
const cmdInput = $("#cmd-input");
const cmdList = $("#cmd-list");
const cmdTrigger = $("#cmd-trigger");

let cmdActiveIndex = 0;
let currentCmds = [];

function getCommands() {
  const isAdmin = state.user && state.user.role === "admin";
  return [
    // Execution & Pipeline
    {
      id: "run-all",
      group: "Compiler Pipeline",
      name: "Run All Compiler Stages",
      desc: "Execute lexical, syntax, semantic, ICG, and program output",
      icon: "play",
      shortcut: "Ctrl+Enter",
      action: () => runStage("output"),
    },
    {
      id: "run-lexical",
      group: "Compiler Pipeline",
      name: "Run Lexical Analysis",
      desc: "Tokenize source text into tokens, identifiers, and categories",
      icon: "01",
      action: () => runStage("lexical"),
    },
    {
      id: "run-syntax",
      group: "Compiler Pipeline",
      name: "Run Syntax Analysis",
      desc: "Parse tokens into Abstract Syntax Tree (AST)",
      icon: "02",
      action: () => runStage("syntax"),
    },
    {
      id: "run-semantic",
      group: "Compiler Pipeline",
      name: "Run Semantic Analysis",
      desc: "Build symbol table and validate scope and type rules",
      icon: "03",
      action: () => runStage("semantic"),
    },
    {
      id: "run-icg",
      group: "Compiler Pipeline",
      name: "Generate Intermediate Code",
      desc: "Generate three-address code (TAC) and quadruples",
      icon: "04",
      action: () => runStage("icg"),
    },
    {
      id: "run-output",
      group: "Compiler Pipeline",
      name: "Execute Program Output",
      desc: "Run virtual machine interpreter to print output and variables",
      icon: "05",
      action: () => runStage("output"),
    },

    // Code Samples & Handout
    {
      id: "sample-handout",
      group: "Sample Programs",
      name: "Load Handout Example (If/Else)",
      desc: "Load the official lab assignment example from the handout",
      icon: "file",
      action: () => {
        sample.value = "Lab handout example";
        code.value = SAMPLES[sample.value];
        updateGutter();
        resetStates();
        showView("workbench");
        toast('Loaded "Lab handout example"');
      },
    },
    {
      id: "sample-working",
      group: "Sample Programs",
      name: "Load Working Program",
      desc: "A complete ZynoScript program demonstrating all language types",
      icon: "file",
      action: () => {
        sample.value = "Working program";
        code.value = SAMPLES[sample.value];
        updateGutter();
        resetStates();
        showView("workbench");
        toast('Loaded "Working program"');
      },
    },
    {
      id: "sample-casting",
      group: "Sample Programs",
      name: "Load Type Casting (as~) Sample",
      desc: "Demonstrates explicit type conversion between whole, part, phrase, flag, and mark",
      icon: "file",
      action: () => {
        sample.value = "Type casting (as~)";
        code.value = SAMPLES[sample.value];
        updateGutter();
        resetStates();
        showView("workbench");
        toast('Loaded "Type casting (as~)"');
      },
    },
    {
      id: "sample-comments",
      group: "Sample Programs",
      name: "Load Comments Guide Sample",
      desc: "Demonstrates single-line (//) and multi-line (#~ ... ~#) comments",
      icon: "file",
      action: () => {
        sample.value = "Comments guide";
        code.value = SAMPLES[sample.value];
        updateGutter();
        resetStates();
        showView("workbench");
        toast('Loaded "Comments guide"');
      },
    },
    {
      id: "sample-loop",
      group: "Sample Programs",
      name: "Load Loop with If/Else Sample",
      desc: "Program calculating odd and even numbers in a loop",
      icon: "loop",
      action: () => {
        sample.value = "Loop with if/else inside";
        code.value = SAMPLES[sample.value];
        updateGutter();
        resetStates();
        showView("workbench");
        toast('Loaded "Loop with if/else"');
      },
    },
    {
      id: "sample-factorial",
      group: "Sample Programs",
      name: "Load Factorial Calculation Sample",
      desc: "Calculates 5! (factorial of 5) using an iterative loop",
      icon: "file",
      action: () => {
        sample.value = "Factorial calculation";
        code.value = SAMPLES[sample.value];
        updateGutter();
        resetStates();
        showView("workbench");
        toast('Loaded "Factorial calculation"');
      },
    },
    {
      id: "sample-fibonacci",
      group: "Sample Programs",
      name: "Load Fibonacci Sequence Sample",
      desc: "Generates the Fibonacci series using a while loop",
      icon: "file",
      action: () => {
        sample.value = "Fibonacci sequence";
        code.value = SAMPLES[sample.value];
        updateGutter();
        resetStates();
        showView("workbench");
        toast('Loaded "Fibonacci sequence"');
      },
    },
    {
      id: "sample-max3",
      group: "Sample Programs",
      name: "Load Find Maximum of 3 Numbers Sample",
      desc: "Finds the largest value among three variables using conditionals",
      icon: "file",
      action: () => {
        sample.value = "Find maximum of 3";
        code.value = SAMPLES[sample.value];
        updateGutter();
        resetStates();
        showView("workbench");
        toast('Loaded "Find maximum of 3"');
      },
    },
    {
      id: "sample-temp",
      group: "Sample Programs",
      name: "Load Temperature Converter Sample",
      desc: "Converts Celsius to Fahrenheit with float arithmetic",
      icon: "file",
      action: () => {
        sample.value = "Temperature converter";
        code.value = SAMPLES[sample.value];
        updateGutter();
        resetStates();
        showView("workbench");
        toast('Loaded "Temperature converter"');
      },
    },
    {
      id: "sample-semantic-errors",
      group: "Sample Programs",
      name: "Load Semantic Errors Test",
      desc: "Sample triggering semantic rules 1, 2, 3, 4, 5, 6, 7",
      icon: "alert",
      action: () => {
        sample.value = "Semantic errors";
        code.value = SAMPLES[sample.value];
        updateGutter();
        resetStates();
        showView("workbench");
        toast('Loaded "Semantic errors" test');
      },
    },
    {
      id: "sample-syntax-errors",
      group: "Sample Programs",
      name: "Load Missing Semicolon Test",
      desc: "Test reporting syntax errors on line 2",
      icon: "alert",
      action: () => {
        sample.value = "Syntax error: missing ;";
        code.value = SAMPLES[sample.value];
        updateGutter();
        resetStates();
        showView("workbench");
        toast('Loaded syntax test');
      },
    },
    {
      id: "sample-lexical-errors",
      group: "Sample Programs",
      name: "Load Lexical Errors Test",
      desc: "Test reporting invalid characters and unclosed strings",
      icon: "alert",
      action: () => {
        sample.value = "Lexical errors";
        code.value = SAMPLES[sample.value];
        updateGutter();
        resetStates();
        showView("workbench");
        toast('Loaded lexical test');
      },
    },

    // Navigation & Workspace
    {
      id: "nav-workbench",
      group: "Navigation",
      name: "Go to Workbench Studio",
      desc: "Main compiler IDE and output inspector",
      icon: "bolt",
      action: () => showView("workbench"),
    },
    {
      id: "nav-grammar",
      group: "Navigation",
      name: "Open Grammar Settings (Slide-Over)",
      desc: "Customize keywords, operators, or view BNF production rules in side sheet",
      icon: "sliders",
      action: () => {
        showView("workbench");
        openGrammarDrawer();
      },
    },
    {
      id: "nav-editor",
      group: "Navigation",
      name: "Source Code Editor",
      desc: "Focus the main ZynoScript code editor",
      icon: "code",
      action: () => {
        showView("workbench");
        code.focus();
      },
    },
    {
      id: "nav-guide",
      group: "Navigation",
      name: "View Language Specification Guide",
      desc: "Documentation of keywords, operators, types, and BNF rules",
      icon: "book",
      action: () => showView("guide"),
    },
    {
      id: "nav-activity",
      group: "Navigation",
      name: "View Activity Log",
      desc: "Audit trail of actions, line counts, and program hashes",
      icon: "activity",
      action: () => showView("activity"),
    },
    ...(isAdmin ? [{
      id: "nav-admin",
      group: "Navigation",
      name: "Admin User Management",
      desc: "Manage users, reset passwords, and audit telemetry",
      icon: "shield",
      action: () => showView("admin"),
    }] : []),

    // Tools & Utilities
    {
      id: "tool-copy",
      group: "Tools",
      name: "Copy Compiler Output",
      desc: "Copy active stage's output text to clipboard",
      icon: "copy",
      action: () => {
        if (btnCopyOutput) btnCopyOutput.click();
      },
    },
    {
      id: "tool-clear",
      group: "Tools",
      name: "Clear Output Inspector",
      desc: "Reset output panel to empty state",
      icon: "trash",
      action: () => {
        if (btnClearOutput) btnClearOutput.click();
      },
    },
    {
      id: "tool-reset-grammar",
      group: "Tools",
      name: "Reset Grammar to Default",
      desc: "Revert all keywords and operators back to original ZynoScript",
      icon: "reset",
      action: () => {
        const btn = $("#grammar-reset");
        if (btn) btn.click();
      },
    },
    {
      id: "tool-theme",
      group: "Tools",
      name: "Toggle Light / Dark Theme",
      desc: "Switch the studio workbench between light and dark appearance",
      icon: document.documentElement.getAttribute("data-theme") === "dark" ? "sun" : "moon",
      action: () => toggleStudioTheme(),
    },
    {
      id: "tool-shortcuts",
      group: "Tools",
      name: "Keyboard Shortcuts Reference",
      desc: "View all studio and editor keyboard shortcuts",
      icon: "keyboard",
      shortcut: "?",
      action: () => openShortcutsDialog(),
    },
    {
      id: "auth-logout",
      group: "Account",
      name: "Sign Out",
      desc: "End active session and return to sign-in screen",
      icon: "logout",
      action: () => {
        const btn = $("#logout");
        if (btn) btn.click();
      },
    },
  ];
}

function openCmdPalette() {
  if (!state.user || !cmdPalette) return;
  cmdPalette.showModal();
  cmdInput.value = "";
  cmdActiveIndex = 0;
  filterAndRenderCommands("");
  setTimeout(() => cmdInput.focus(), 50);
}

function closeCmdPalette() {
  if (!cmdPalette || !cmdPalette.open) return;
  cmdPalette.close();
}

function filterAndRenderCommands(query) {
  const q = query.trim().toLowerCase();
  const all = getCommands();
  currentCmds = q
    ? all.filter(c => c.name.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q) || c.group.toLowerCase().includes(q))
    : all;

  if (cmdActiveIndex >= currentCmds.length) cmdActiveIndex = 0;

  if (!currentCmds.length) {
    cmdList.innerHTML = `<div class="cmd-empty">No commands matching "<b>${esc(query)}</b>"</div>`;
    return;
  }

  let html = "";
  let lastGroup = "";
  currentCmds.forEach((cmd, idx) => {
    if (cmd.group !== lastGroup) {
      lastGroup = cmd.group;
      html += `<div class="cmd-group-title">${esc(lastGroup)}</div>`;
    }
    const isActive = idx === cmdActiveIndex;
    html += `
      <div class="cmd-item ${isActive ? 'is-active' : ''}" data-cmd-idx="${idx}" role="option" aria-selected="${isActive}">
        <div class="cmd-item-left">
          <span class="cmd-item-icon" aria-hidden="true">${ICONS[cmd.icon] ? icon(cmd.icon) : esc(cmd.icon)}</span>
          <div class="cmd-item-text">
            <span class="cmd-item-name">${esc(cmd.name)}</span>
            <span class="cmd-item-desc">${esc(cmd.desc)}</span>
          </div>
        </div>
        ${cmd.shortcut ? `<kbd class="cmd-item-shortcut">${cmd.shortcut}</kbd>` : ''}
      </div>
    `;
  });
  cmdList.innerHTML = html;

  const activeEl = cmdList.querySelector(".cmd-item.is-active");
  if (activeEl) activeEl.scrollIntoView({ block: "nearest" });
}

function executeActiveCommand() {
  if (!currentCmds.length) return;
  const cmd = currentCmds[cmdActiveIndex];
  closeCmdPalette();
  if (cmd && typeof cmd.action === "function") {
    cmd.action();
  }
}

if (cmdPalette && cmdInput) {
  // Global Shortcut: Ctrl+K or Cmd+K
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      if (!state.user) return;
      e.preventDefault();
      if (cmdPalette.open) closeCmdPalette();
      else openCmdPalette();
    }
  });

  // Trigger button in header
  if (cmdTrigger) {
    cmdTrigger.addEventListener("click", () => openCmdPalette());
  }

  // Backdrop click to close
  cmdPalette.addEventListener("click", (e) => {
    if (e.target === cmdPalette) closeCmdPalette();
  });

  // Input filter
  cmdInput.addEventListener("input", () => {
    cmdActiveIndex = 0;
    filterAndRenderCommands(cmdInput.value);
  });

  // Key navigation inside input
  cmdInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!currentCmds.length) return;
      cmdActiveIndex = (cmdActiveIndex + 1) % currentCmds.length;
      updateActiveItem();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!currentCmds.length) return;
      cmdActiveIndex = (cmdActiveIndex - 1 + currentCmds.length) % currentCmds.length;
      updateActiveItem();
    } else if (e.key === "Enter") {
      e.preventDefault();
      executeActiveCommand();
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeCmdPalette();
    }
  });

  function updateActiveItem() {
    $$(".cmd-item", cmdList).forEach((el, idx) => {
      const isAct = idx === cmdActiveIndex;
      el.classList.toggle("is-active", isAct);
      el.setAttribute("aria-selected", String(isAct));
      if (isAct) el.scrollIntoView({ block: "nearest" });
    });
  }

  // Click on command item
  cmdList.addEventListener("click", (e) => {
    const item = e.target.closest(".cmd-item");
    if (!item) return;
    const idx = +item.dataset.cmdIdx;
    cmdActiveIndex = idx;
    executeActiveCommand();
  });
}

/* =========================================
   THEME TOGGLE, KEYBOARD SHORTCUTS MODAL,
   RESIZABLE SPLIT & MOBILE WORKBENCH TABS
   ========================================= */
const btnThemeToggle = $("#btn-theme-toggle");
const btnShortcutsHelp = $("#btn-shortcuts-help");
const dlgShortcuts = $("#dlg-shortcuts");

function syncThemeToggleIcon() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const iconEl = $("#theme-icon");
  if (iconEl) {
    iconEl.dataset.icon = isDark ? "sun" : "moon";
    if (typeof hydrateIcons === "function") hydrateIcons(btnThemeToggle || document);
    else if (typeof icon === "function") iconEl.innerHTML = icon(isDark ? "sun" : "moon");
  }
  if (btnThemeToggle) {
    btnThemeToggle.title = isDark ? "Switch to Light Mode" : "Switch to Dark Mode";
    btnThemeToggle.setAttribute("aria-pressed", String(isDark));
  }
}

function toggleStudioTheme() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const next = isDark ? "light" : "dark";
  if (next === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  try {
    localStorage.setItem("zs_theme", next);
  } catch {}
  syncThemeToggleIcon();
  toast(next === "dark" ? "Dark mode enabled" : "Light mode enabled");
}

function openShortcutsDialog() {
  if (!dlgShortcuts) return;
  if (typeof dlgShortcuts.showModal === "function" && !dlgShortcuts.open) {
    dlgShortcuts.showModal();
  }
}

syncThemeToggleIcon();

if (btnThemeToggle) {
  btnThemeToggle.addEventListener("click", () => toggleStudioTheme());
}

if (btnShortcutsHelp && dlgShortcuts) {
  btnShortcutsHelp.addEventListener("click", () => openShortcutsDialog());
  dlgShortcuts.addEventListener("click", (e) => {
    if (e.target === dlgShortcuts) dlgShortcuts.close();
  });
}

window.addEventListener("keydown", (e) => {
  if (!state.user) return;
  const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
  const isEditable = tag === "input" || tag === "textarea" || tag === "select" || (e.target && e.target.isContentEditable);
  if (!isEditable && e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    if (dlgShortcuts && dlgShortcuts.open) dlgShortcuts.close();
    else openShortcutsDialog();
  }
});

// Desktop Resizable Split Between Editor and Inspector
const studioResizer = $("#studio-resizer");
const studioGrid = $("#studio-grid");
if (studioResizer && studioGrid) {
  let dragging = false;
  studioResizer.addEventListener("mousedown", (e) => {
    if (window.innerWidth <= 960) return;
    dragging = true;
    studioResizer.classList.add("is-dragging");
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    e.preventDefault();
  });
  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const rect = studioGrid.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const pct = Math.max(28, Math.min(72, (relX / rect.width) * 100));
    studioGrid.style.setProperty("--editor-col", `${pct}fr`);
    studioGrid.style.setProperty("--inspector-col", `${100 - pct}fr`);
  });
  window.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    studioResizer.classList.remove("is-dragging");
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  });
  studioResizer.addEventListener("dblclick", () => {
    studioGrid.style.removeProperty("--editor-col");
    studioGrid.style.removeProperty("--inspector-col");
  });
}

// Mobile Workbench Tabs (Code Editor vs Compiler Output + Quick Run)
const mobTabsWrap = $("#mobile-workbench-tabs");
const mobFabRun = $("#mob-fab-run");
if (mobTabsWrap && studioGrid) {
  $$(".mob-wb-tab", mobTabsWrap).forEach((tabBtn) => {
    tabBtn.addEventListener("click", () => {
      const target = tabBtn.dataset.mobPane;
      studioGrid.dataset.mobilePane = target;
      $$(".mob-wb-tab", mobTabsWrap).forEach((b) => {
        const active = b.dataset.mobPane === target;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-selected", String(active));
      });
    });
  });
}
if (mobFabRun) {
  mobFabRun.addEventListener("click", () => {
    if (studioGrid) {
      studioGrid.dataset.mobilePane = "inspector";
      if (mobTabsWrap) {
        $$(".mob-wb-tab", mobTabsWrap).forEach((b) => {
          const active = b.dataset.mobPane === "inspector";
          b.classList.toggle("is-active", active);
          b.setAttribute("aria-selected", String(active));
        });
      }
    }
    runStage("output");
  });
}


