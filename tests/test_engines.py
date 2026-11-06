"""Engine tests: every engine is called on its own, with plain data in and plain data out."""
import unittest

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
        src = "#~ multi-line\n   block comment ~#\nlet whole x := 10;\nbeam x;\nhalt;"
        r = lexical.run(src, G)
        self.assertTrue(r["ok"])
        self.assertEqual(r["tokens"][0]["lexeme"], "let")
        self.assertEqual(r["tokens"][0]["line"], 3)

    def test_lexer_unterminated_block_comment_reported(self):
        r = lexical.run("let whole a := 1;\n#~ unclosed comment\nbeam a;", G)
        self.assertFalse(r["ok"])
        self.assertEqual(r["errors"][0]["line"], 2)
        self.assertIn("unterminated block comment", r["errors"][0]["message"])

    def test_grammar_rejects_comment_marker_collision(self):
        bad = grammar.default()
        bad["operators"]["DIV"] = "//"
        problems = grammar.validate(bad)
        self.assertTrue(any("clashes with comment markers" in p for p in problems))

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

    def test_parser_missing_semicolon(self):
        r = syntax.run(lexical.run("let whole a := 5\nhalt;", G)["tokens"], G)
        self.assertFalse(r["ok"])
        self.assertEqual(r["errors"][0]["line"], 2)

    def test_semantic_rules(self):
        src = 'let whole a := 5;\nlet whole a := 7;\nlet flag f := 3;\nwhenTrue (a) {\n}\nhalt;'
        rules = [e["rule"] for e in semantic.run(ast_of(src), G)["errors"]]
        self.assertEqual(rules, [1, 3, 6])

    def test_handout_syntax_untyped_and_no_braces(self):
        ast = ast_of('let x := 5;\nlet y := 10;\nwhenTrue x <<= y\n    beam "small";\nelseWay\n    beam "big";\nhalt;')
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


if __name__ == "__main__":
    unittest.main()
