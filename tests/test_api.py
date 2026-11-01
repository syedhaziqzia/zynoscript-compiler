"""API tests: login, per-stage compile, grammar editing, logs.   Run:  python -m unittest discover tests"""
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from app import config, db

config.DB_PATH = Path(tempfile.mkdtemp()) / "test.db"
db.DB_PATH = config.DB_PATH
from app.main import app  # noqa: E402

GOOD = "let whole a := 5;\nbeam a +~ 1;\nhalt;"


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ctx = TestClient(app)
        cls.client = cls.ctx.__enter__()
        r = cls.client.post("/api/auth/register", json={"username": "admin1", "password": "secret1"})
        cls.admin = {"Authorization": "Bearer " + r.json()["token"]}
        r = cls.client.post("/api/auth/register", json={"username": "ali", "password": "secret2"})
        cls.ali = {"Authorization": "Bearer " + r.json()["token"]}

    @classmethod
    def tearDownClass(cls):
        cls.ctx.__exit__(None, None, None)

    def test_requires_login(self):
        self.assertEqual(self.client.post("/api/compile/lexical", json={"source": GOOD}).status_code, 401)

    def test_remember_me_session_lasts_longer(self):
        from app.db import connect
        for remember, hours in ((False, 12), (True, 24 * 30)):
            tok = self.client.post("/api/auth/login", json={"username": "ali", "password": "secret2", "remember": remember}).json()["token"]
            with connect() as conn:
                exp = conn.execute("SELECT expires_at FROM sessions WHERE token = ?", (tok,)).fetchone()[0]
            from datetime import datetime, timedelta, timezone
            left = datetime.strptime(exp, "%Y-%m-%d %H:%M:%S") - datetime.now(timezone.utc).replace(tzinfo=None)
            self.assertAlmostEqual(left.total_seconds() / 3600, hours, delta=1)

    def test_wrong_password(self):
        r = self.client.post("/api/auth/login", json={"username": "ali", "password": "nope-nope"})
        self.assertEqual(r.status_code, 401)

    def test_each_stage_runs_alone(self):
        for stage in ("lexical", "syntax", "semantic", "icg"):
            r = self.client.post(f"/api/compile/{stage}", json={"source": GOOD}, headers=self.ali).json()
            self.assertTrue(r["results"][stage]["ok"], stage)

    def test_syntax_error_blocks_later_stages(self):
        r = self.client.post("/api/compile/icg", json={"source": "let whole a := 5\nhalt;"}, headers=self.ali).json()
        self.assertEqual(r["blocked_by"], "syntax")
        self.assertNotIn("semantic", r["results"])

    def test_semantic_errors_listed(self):
        r = self.client.post("/api/compile/semantic", json={"source": "b := 1;\nhalt;"}, headers=self.ali).json()
        self.assertEqual(r["results"]["semantic"]["errors"][0]["line"], 1)

    def test_grammar_change_changes_language(self):
        g = self.client.get("/api/grammar", headers=self.ali).json()["grammar"]
        g["keywords"]["PRINT"] = "show"
        self.assertEqual(self.client.put("/api/grammar", json=g, headers=self.ali).status_code, 200)
        r = self.client.post("/api/compile/syntax", json={"source": "show 1;\nhalt;"}, headers=self.ali).json()
        self.assertTrue(r["results"]["syntax"]["ok"])
        self.client.post("/api/grammar/reset", headers=self.ali)

    def test_bad_grammar_rejected(self):
        g = self.client.get("/api/grammar", headers=self.admin).json()["grammar"]
        g["keywords"]["IF"] = "beam"
        self.assertEqual(self.client.put("/api/grammar", json=g, headers=self.admin).status_code, 422)

    def test_admin_tools(self):
        reg = self.client.post("/api/auth/register", json={"username": "temp1", "password": "secret3"}).json()
        uid = reg["user"]["id"]
        self.assertEqual(self.client.get("/api/admin/users", headers=self.ali).status_code, 403)     # normal user is refused
        users = self.client.get("/api/admin/users", headers=self.admin).json()["users"]
        self.assertIn("temp1", [u["username"] for u in users])
        r = self.client.post(f"/api/admin/users/{uid}/password", json={"password": "newsecret"}, headers=self.admin)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.client.get("/api/auth/me", headers={"Authorization": "Bearer " + reg["token"]}).status_code, 401)
        self.assertEqual(self.client.post("/api/auth/login", json={"username": "temp1", "password": "newsecret"}).status_code, 200)
        admin_id = self.client.get("/api/auth/me", headers=self.admin).json()["id"]
        self.assertEqual(self.client.delete(f"/api/admin/users/{admin_id}", headers=self.admin).status_code, 409)
        self.assertEqual(self.client.post(f"/api/admin/users/{admin_id}/role", json={"role": "user"}, headers=self.admin).status_code, 409)
        self.assertEqual(self.client.delete(f"/api/admin/users/{uid}", headers=self.admin).status_code, 200)
        self.assertEqual(self.client.post("/api/auth/login", json={"username": "temp1", "password": "newsecret"}).status_code, 401)

    def test_logs_scope(self):
        self.client.post("/api/compile/lexical", json={"source": GOOD}, headers=self.ali)
        mine = self.client.get("/api/logs", headers=self.ali).json()
        self.assertEqual({row["username"] for row in mine["logs"]}, {"ali"})
        everyone = self.client.get("/api/logs", headers=self.admin).json()
        self.assertGreater(len({row["username"] for row in everyone["logs"]}), 1)

    def test_unknown_user_login(self):
        r = self.client.post("/api/auth/login", json={"username": "ghost_user_999", "password": "password123"})
        self.assertEqual(r.status_code, 401)

    def test_logs_limit_clamped(self):
        # Negative limit should be clamped to at least 1, not cause unrestricted dump
        r = self.client.get("/api/logs?limit=-10", headers=self.ali).json()
        self.assertLessEqual(len(r["logs"]), 1)

    def test_cors_headers(self):
        r = self.client.options("/api/logs", headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"})
        self.assertIn(r.headers.get("access-control-allow-origin"), ["*", "http://localhost:3000"])


if __name__ == "__main__":
    unittest.main()
