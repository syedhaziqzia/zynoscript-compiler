"""Engine tests: every engine is called on its own, with plain data in and plain data out."""
import json
import subprocess
import unittest
from pathlib import Path

from app import pipeline
from app.engines import grammar, icg, lexical, output, semantic, syntax

G = grammar.default()


def ast_of(src):
    return syntax.run(lexical.run(src, G)["tokens"], G)["ast"]


class EngineTests(unittest.TestCase):
    def test_lexer_longest_operator(self):
        kinds = [t["kind"] for t in lexical.run("a &&~ b", G)["tokens"]]
        self.assertEqual(kinds, ["ID", "AND", "ID"])

    def test_lexer_reports_all_errors(self):
        r = lexical.run('let whole a := 1 @ 2;\nlet phrase s := "open;', G)
        self.assertEqual([e["line"] for e in r["errors"]], [1, 2])

    def test_lexer_identifier_table(self):
        ids = lexical.run("let whole a := 1;\na := a +~ 2;", G)["identifiers"]
        self.assertEqual(ids, [{"name": "a", "first_line": 1, "count": 3}])

    def test_lexer_ignores_comments(self):
        r = lexical.run("let whole a := 1; // comment here\nbeam a; // another comment", G)
        self.assertTrue(r["ok"])
        self.assertEqual([t["lexeme"] for t in r["tokens"]], ["let", "whole", "a", ":=", "1", ";", "beam", "a", ";"])

    def test_lexer_block_comments_and_line_tracking(self):
        src = "/~~ multi-line\n   block comment ~~/\nlet whole x := 10;\nbeam x;\nhalt;"
        r = lexical.run(src, G)
        self.assertTrue(r["ok"])
        self.assertEqual(r["tokens"][0]["lexeme"], "let")
        self.assertEqual(r["tokens"][0]["line"], 3)

        # Legacy #~ ... ~# also supported
        src_legacy = "#~ legacy\n   comment ~#\nlet whole y := 5;\nhalt;"
        r_leg = lexical.run(src_legacy, G)
        self.assertTrue(r_leg["ok"])
        self.assertEqual(r_leg["tokens"][0]["line"], 3)

    def test_lexer_unterminated_block_comment_reported(self):
        r = lexical.run("let whole a := 1;\n/~~ unclosed comment\nbeam a;", G)
        self.assertFalse(r["ok"])
        self.assertEqual(r["errors"][0]["line"], 2)
        self.assertIn("unterminated block comment", r["errors"][0]["message"])

    def test_grammar_rejects_comment_marker_collision(self):
        bad = grammar.default()
        bad["operators"]["DIV"] = "//"
        problems = grammar.validate(bad)
        self.assertTrue(any("clashes with comment markers" in p for p in problems))

        bad2 = grammar.default()
        bad2["operators"]["MUL"] = "/~~"
        problems2 = grammar.validate(bad2)
        self.assertTrue(any("clashes with comment markers" in p for p in problems2))

    def test_type_casting_all_stages(self):
        src = (
            'let part pi := 3.89;\n'
            'let whole w := pi as~ whole;\n'
            'let part p := w as~ part;\n'
            'let whole parsed := "42" as~ whole;\n'
            'let whole b := true as~ whole;\n'
            'let flag f := 0 as~ flag;\n'
            'let whole code := \'A\' as~ whole;\n'
            'let mark ch := 66 as~ mark;\n'
            'let phrase s := (w +~ parsed) as~ phrase;\n'
            'beam w;\n'
            'beam p;\n'
            'beam b;\n'
            'beam f;\n'
            'beam code;\n'
            'beam ch;\n'
            'beam s;\n'
            'halt;'
        )
        res = pipeline.run("output", src, G)
        self.assertIsNone(res["blocked_by"])
        self.assertEqual(res["results"]["output"]["output"], ["3", "3.0", "1", "false", "65", "B", "45"])
        self.assertTrue(any(q["op"] == "as~" for q in res["results"]["icg"]["quads"]))

    def test_type_casting_semantic_and_runtime_errors(self):
        # Semantic Rule 8: mark -> part is not a permitted cast
        bad_cast_ast = ast_of("let mark c := 'A';\nlet part p := c as~ part;\nhalt;")
        sem = semantic.run(bad_cast_ast, G)
        self.assertFalse(sem["ok"])
        self.assertEqual(sem["errors"][0]["rule"], 8)

        # Runtime error: non-numeric phrase -> whole
        bad_runtime_ast = ast_of('let whole n := "abc" as~ whole;\nbeam n;\nhalt;')
        out = output.run(bad_runtime_ast, G)
        self.assertFalse(out["ok"])
        self.assertIn("cannot convert phrase", out["errors"][0]["message"])

    def test_browser_and_server_compiler_parity(self):
        root = Path(__file__).resolve().parent.parent
        node_script = r"""
const fs = require("fs");
const vm = require("vm");
const samplesCode = fs.readFileSync("public/js/samples.js", "utf8");
const appCode = fs.readFileSync("public/js/app.js", "utf8");

// Extract pure compiler functions up to "const compileCache = new Map();"
const pureCompilerCode = appCode.split("const compileCache = new Map();")[0];
const sandbox = { window: {}, document: { querySelector: () => null, querySelectorAll: () => [] }, console };
vm.createContext(sandbox);
vm.runInContext(samplesCode + "\n" + pureCompilerCode + "\nwindow.SAMPLES = SAMPLES; window.compileLocal = compileLocal; window.ZS_DEFAULT_GRAMMAR = ZS_DEFAULT_GRAMMAR;", sandbox);

const out = {};
for (const [name, code] of Object.entries(sandbox.window.SAMPLES)) {
  out[name] = {
    code,
    res: sandbox.window.compileLocal("output", code, sandbox.window.ZS_DEFAULT_GRAMMAR)
  };
}
process.stdout.write(JSON.stringify(out));
"""
        proc = subprocess.run(
            ["node", "-e", node_script],
            cwd=str(root),
            capture_output=True,
            text=True,
            check=True,
        )
        js_bundle = json.loads(proc.stdout)
        self.assertGreaterEqual(len(js_bundle), 8)

        error_presets = {"Lexical errors", "Syntax error: incomplete statement", "Semantic errors"}
        runtime_error_presets = {"Runtime error: division by zero"}
        for name, item in js_bundle.items():
            code = item["code"]
            js_res = item["res"]
            py_res = pipeline.run("output", code, G)
            if name in error_presets:
                self.assertIsNotNone(py_res["blocked_by"], f"Expected {name} to fail a compiler stage")
            elif name in runtime_error_presets:
                self.assertIsNone(py_res["blocked_by"], f"Expected {name} to reach output stage")
                self.assertFalse(py_res["results"]["output"]["ok"], f"Expected {name} to fail at runtime in output stage")
            else:
                self.assertIsNone(py_res["blocked_by"], f"Expected {name} to pass all stages without error, blocked by {py_res['blocked_by']}")
                self.assertTrue(py_res["results"]["output"]["ok"], f"Expected {name} output stage to succeed")
            self.assertEqual(js_res["blocked_by"], py_res["blocked_by"], f"Blocked_by mismatch in {name}")
            for stg in ("lexical", "syntax", "semantic", "icg", "output"):
                if stg in py_res["results"]:
                    self.assertEqual(js_res["results"][stg]["ok"], py_res["results"][stg]["ok"], f"{stg} ok mismatch in {name}")
                    self.assertEqual(
                        len(js_res["results"][stg]["errors"]),
                        len(py_res["results"][stg]["errors"]),
                        f"{stg} error count mismatch in {name}",
                    )
            if "output" in py_res["results"] and py_res["results"]["output"]["ok"]:
                self.assertEqual(
                    js_res["results"]["output"]["output"],
                    py_res["results"]["output"]["output"],
                    f"Console output mismatch in {name}",
                )

    def test_lexer_line_and_category_tables(self):
        r = lexical.run("let whole a := 1;\nbeam a;", G)
        self.assertEqual(len(r["lines"]), 2)
        self.assertEqual([t["lexeme"] for t in r["lines"][1]["tokens"]], ["beam", "a", ";"])
        cats = {c["category"]: c for c in r["categories"]}
        self.assertEqual(cats["Identifier"]["count"], 2)
        self.assertEqual(cats["Identifier"]["lexemes"], ["a"])

    def test_parser_precedence(self):
        ast = ast_of("let whole a := 1 +~ 2 *~ 3;\nhalt;")
        self.assertEqual(ast[0]["init"]["op"], "ADD")
        self.assertEqual(ast[0]["init"]["right"]["op"], "MUL")

    def test_parser_incomplete_statement(self):
        r = syntax.run(lexical.run("let whole a := 5\nlet whole b := 10 +~\nhalt", G)["tokens"], G)
        self.assertFalse(r["ok"])
        self.assertEqual(r["errors"][0]["line"], 3)

    def test_semicolons_optional(self):
        r = syntax.run(lexical.run("let whole a := 5\nlet whole b := 10;\nhalt", G)["tokens"], G)
        self.assertTrue(r["ok"])

    def test_semantic_rules(self):
        src = 'let whole a := 5;\nlet whole a := 7;\nlet flag f := 3;\nwhenTrue (a) {\n}\nhalt;'
        rules = [e["rule"] for e in semantic.run(ast_of(src), G)["errors"]]
        self.assertEqual(rules, [1, 3, 6])

    def test_handout_syntax_untyped_and_no_braces(self):
        ast = ast_of('let x := 5\nlet y := 10\nwhenTrue x <<= y\n    beam "small"\nelseWay\n    beam "big"\nhalt')
        self.assertEqual(ast[0]["type"], "auto")
        sem = semantic.run(ast, G)
        self.assertTrue(sem["ok"])
        self.assertEqual(sem["symbols"][0]["type"], "whole")
        self.assertEqual(output.run(ast, G)["output"], ["small"])

    def test_icg_loop_labels(self):
        out = icg.run(ast_of("let whole i := 0;\nspin (i <<= 3) {\ni := i +~ 1;\n}\nhalt;"), G)
        self.assertIn("L1:", out["tac"])
        self.assertIn("    goto L1", out["tac"])
        self.assertEqual(out["quads"][-1]["op"], "halt")


if __name__ == "__main__":
    unittest.main()


class OutputEngineTests(unittest.TestCase):
    def run_program(self, src):
        return output.run(ast_of(src), G)

    def test_prints_and_loops(self):
        r = self.run_program("let whole a := 5; let whole b := 2; beam a /~ b; spin (b <<= 4) { beam b; b := b +~ 1; } halt;")
        self.assertTrue(r["ok"])
        self.assertEqual(r["output"], ["2", "2", "3"])

    def test_booleans_print_with_user_words(self):
        r = self.run_program("let flag f := true; beam f; halt;")
        self.assertEqual(r["output"], ["true"])

    def test_division_by_zero_is_reported(self):
        r = self.run_program("let whole z := 0; beam 4 /~ z; halt;")
        self.assertFalse(r["ok"])
        self.assertEqual(r["errors"][0]["line"], 1)
        self.assertIn("division by zero", r["errors"][0]["message"])

    def test_endless_loop_is_stopped(self):
        r = self.run_program("let flag t := true; spin (t) { } halt;")
        self.assertFalse(r["ok"])
        self.assertIn("stopped after", r["errors"][0]["message"])


class UnaryNegationTests(unittest.TestCase):
    def test_negation_integers(self):
        r1 = output.run(ast_of("beam -~ 5;\nhalt;"), G)
        self.assertTrue(r1["ok"])
        self.assertEqual(r1["output"], ["-5"])

        r2 = output.run(ast_of("let whole a := -~ 3;\nbeam a;\nhalt;"), G)
        self.assertTrue(r2["ok"])
        self.assertEqual(r2["output"], ["-3"])

    def test_negation_floats_and_grouped_expressions(self):
        r1 = output.run(ast_of("beam -~ 3.14;\nhalt;"), G)
        self.assertTrue(r1["ok"])
        self.assertEqual(r1["output"], ["-3.14"])

        r2 = output.run(ast_of("beam -~ (2 +~ 3);\nhalt;"), G)
        self.assertTrue(r2["ok"])
        self.assertEqual(r2["output"], ["-5"])

    def test_double_negation(self):
        r = output.run(ast_of("beam -~ -~ 5;\nhalt;"), G)
        self.assertTrue(r["ok"])
        self.assertEqual(r["output"], ["5"])

    def test_negate_string_semantic_error(self):
        src = 'let phrase s := "x";\nbeam -~ s;\nhalt;'
        sem = semantic.run(ast_of(src), G)
        self.assertFalse(sem["ok"])
        self.assertEqual(sem["errors"][0]["line"], 2)
        self.assertIn("cannot negate a phrase value", sem["errors"][0]["message"])

    def test_tac_and_tree_text_negate(self):
        ast = ast_of("beam -~ a;\nhalt;")
        tree = syntax.tree_text(ast)
        self.assertTrue(any("Negate" in line for line in tree))
        ir = icg.run(ast, G)
        self.assertTrue(any("neg" in line for line in ir["tac"]))

    def test_binary_subtraction_still_works(self):
        r = output.run(ast_of("let whole a := 10;\nlet whole b := 4;\nbeam a -~ b;\nhalt;"), G)
        self.assertTrue(r["ok"])
        self.assertEqual(r["output"], ["6"])


if __name__ == "__main__":
    unittest.main()
