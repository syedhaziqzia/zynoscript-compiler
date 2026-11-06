"""API tests: login, per-stage compile, grammar editing, logs.   Run:  python -m unittest discover tests"""
import os
import tempfile
import unittest
from pathlib import Path

os.environ["ADMIN_USERNAME"] = "test_admin"
os.environ["ADMIN_PASSWORD"] = "Test#Pass2026!"

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
        r = cls.client.post("/api/auth/login", json={"username": config.DEFAULT_ADMIN_USERNAME, "password": config.DEFAULT_ADMIN_PASSWORD})
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
        self.assertEqual(self.client.post("/api/auth/login", json={"username": "temp1", "password": "newsecret"}).status_code, 404)


    def test_logs_scope(self):
        self.client.post("/api/compile/lexical", json={"source": GOOD}, headers=self.ali)
        mine = self.client.get("/api/logs", headers=self.ali).json()
        self.assertEqual({row["username"] for row in mine["logs"]}, {"ali"})
        everyone = self.client.get("/api/logs", headers=self.admin).json()
        self.assertGreater(len({row["username"] for row in everyone["logs"]}), 1)

    def test_unknown_user_login(self):
        r = self.client.post("/api/auth/login", json={"username": "ghost_user_999", "password": "password123"})
        self.assertEqual(r.status_code, 404)
        self.assertIn("No account found", r.json()["detail"]["message"])
        self.assertEqual(r.json()["detail"]["action"], "register")

    def test_duplicate_username_guidance(self):
        r = self.client.post("/api/auth/register", json={"username": "ali", "password": "anotherpassword"})
        self.assertEqual(r.status_code, 409)
        self.assertIn("already registered", r.json()["detail"]["message"])
        self.assertEqual(r.json()["detail"]["action"], "login")

    def test_logs_limit_clamped(self):
        # Negative limit should be clamped to at least 1, not cause unrestricted dump
        r = self.client.get("/api/logs?limit=-10", headers=self.ali).json()
        self.assertLessEqual(len(r["logs"]), 1)

    def test_cors_headers(self):
        r = self.client.options("/api/logs", headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"})
        self.assertIn(r.headers.get("access-control-allow-origin"), ["*", "http://localhost:3000"])

    def test_vercel_rewrite_path_restoration(self):
        # 1. Header-based path restoration (x-matched-path)
        r1 = self.client.post("/api/index.py", json={"username": "ali", "password": "secret2"}, headers={"x-matched-path": "/api/auth/login"})
        self.assertEqual(r1.status_code, 200)
        self.assertIn("token", r1.json())

        # 2. Query param path restoration (?__path=...)
        r2 = self.client.post("/api/index.py?__path=auth/login", json={"username": "ali", "password": "secret2"})
        self.assertEqual(r2.status_code, 200)
        self.assertIn("token", r2.json())

    def test_vercel_rewrite_not_found_on_unknown_api(self):
        r = self.client.post("/api/index.py?__path=unknown_stage", json={})
        self.assertEqual(r.status_code, 404)

    def test_database_url_comment_sanitization(self):
        import os
        from app.db import get_database_url
        old_val = os.environ.get("DATABASE_URL")
        try:
            # Simulate multi-line pasted .env with comments
            os.environ["DATABASE_URL"] = (
                "# Cloud PostgreSQL database connection string\n"
                "DATABASE_URL=postgresql://neondb_owner:secret@ep-xyz.us-east-1.aws.neon.tech/neondb?sslmode=require"
            )
            url = get_database_url()
            self.assertEqual(url, "postgresql://neondb_owner:secret@ep-xyz.us-east-1.aws.neon.tech/neondb?sslmode=require")

            # Comment only
            os.environ["DATABASE_URL"] = "# Just a comment"
            self.assertEqual(get_database_url(), "")
        finally:
            if old_val is not None:
                os.environ["DATABASE_URL"] = old_val
            else:
                os.environ.pop("DATABASE_URL", None)


    def test_registration_always_creates_normal_user(self):
        r = self.client.post("/api/auth/register", json={"username": "normal_dev", "password": "password123"})
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.json()["user"]["role"], "user")

    def test_admin_telemetry(self):
        r = self.client.get("/api/admin/telemetry", headers=self.admin)
        self.assertEqual(r.status_code, 200)
        data = r.json()["telemetry"]
        self.assertIn("total_users", data)
        self.assertIn("stages", data)
        self.assertIn("lexical", data["stages"])
        self.assertIn("db_backend", data)
        # Normal user cannot access
        self.assertEqual(self.client.get("/api/admin/telemetry", headers=self.ali).status_code, 403)

    def test_admin_user_grammar_inspection_and_reset(self):
        from app.engines import grammar as G
        uid = self.client.get("/api/auth/me", headers=self.ali).json()["id"]
        # Ali sets custom grammar
        cg = G.default()
        cg["keywords"]["HALT"] = "stop"
        r_put = self.client.put("/api/grammar", json={
            "keywords": cg["keywords"],
            "operators": cg["operators"]
        }, headers=self.ali)
        self.assertEqual(r_put.status_code, 200)

        # Admin inspects Ali's grammar
        inspect_res = self.client.get(f"/api/admin/users/{uid}/grammar", headers=self.admin)
        self.assertEqual(inspect_res.status_code, 200)
        self.assertTrue(inspect_res.json()["has_custom"])
        self.assertEqual(inspect_res.json()["grammar"]["keywords"]["HALT"], "stop")


        # Admin resets Ali's grammar
        reset_res = self.client.post(f"/api/admin/users/{uid}/grammar/reset", headers=self.admin)
        self.assertEqual(reset_res.status_code, 200)

        # Now Ali has default grammar
        inspect_res2 = self.client.get(f"/api/admin/users/{uid}/grammar", headers=self.admin)
        self.assertFalse(inspect_res2.json()["has_custom"])

    def test_admin_prune_logs(self):
        # Admin can clear logs
        r = self.client.post("/api/admin/logs/prune", json={"days": 0}, headers=self.admin)
        self.assertEqual(r.status_code, 200)
        # Normal user cannot prune logs
        self.assertEqual(self.client.post("/api/admin/logs/prune", json={"days": 0}, headers=self.ali).status_code, 403)

    def test_connect_contextmanager_exception_safety(self):
        from app.db import connect
        with self.assertRaises(ValueError):
            with connect() as conn:
                raise ValueError("caller exception should propagate cleanly")

    def test_admin_list_users_and_log_filtering(self):
        # Admin gets list of users with runs, last_active, has_custom_grammar
        r = self.client.get("/api/admin/users", headers=self.admin)
        self.assertEqual(r.status_code, 200)
        users = r.json()["users"]
        self.assertTrue(any(u["username"] == "ali" for u in users))
        for u in users:
            self.assertIn("has_custom_grammar", u)
            self.assertIn("runs", u)

        # Ali runs a compile stage to generate log
        self.client.post("/api/compile/lexical", json={"source": "let int x := 10; halt;"}, headers=self.ali)

        # Admin filters logs specifically for Ali
        logs_ali = self.client.get("/api/logs?username=ali&status=ok", headers=self.admin).json()
        self.assertTrue(all(l["username"] == "ali" for l in logs_ali["logs"]))
        self.assertTrue(all(l["status"] == "ok" for l in logs_ali["logs"]))

    def test_pg_cursor_wrapper_no_args(self):

        from unittest.mock import MagicMock
        from app.db import PgCursorWrapper
        mock_raw = MagicMock()
        mock_raw.description = None
        wrapper = PgCursorWrapper(mock_raw)
        # Execute query with % and no args - must call mock_raw.execute with 1 arg, never tuple ()
        wrapper.execute("SELECT * FROM activity_log WHERE action LIKE 'run_%'")
        mock_raw.execute.assert_called_once_with("SELECT * FROM activity_log WHERE action LIKE 'run_%'")

    def test_security_headers(self):
        r = self.client.get("/api/auth/me")
        self.assertEqual(r.headers.get("X-Frame-Options"), "DENY")
        self.assertEqual(r.headers.get("X-Content-Type-Options"), "nosniff")
        self.assertEqual(r.headers.get("X-XSS-Protection"), "1; mode=block")
        self.assertEqual(r.headers.get("Referrer-Policy"), "strict-origin-when-cross-origin")
        self.assertEqual(r.headers.get("Permissions-Policy"), "camera=(), microphone=(), geolocation=()")
        self.assertEqual(r.headers.get("Cache-Control"), "no-store")

    def test_login_brute_force_rate_limit(self):
        from app import ratelimit
        ratelimit.reset()
        for _ in range(config.LOGIN_MAX_FAILURES):
            res = self.client.post("/api/auth/login", json={"username": "ali", "password": "wrongpassword"})
            self.assertEqual(res.status_code, 401)
        blocked = self.client.post("/api/auth/login", json={"username": "ali", "password": "wrongpassword"})
        self.assertEqual(blocked.status_code, 429)
        ratelimit.reset()

    def test_health_endpoint_and_source_size_cap(self):
        h = self.client.get("/api/health")
        self.assertEqual(h.status_code, 200)
        self.assertTrue(h.json().get("ok"))

        huge_src = "let whole a := 1;\n" * 800  # > 10,000 chars
        r = self.client.post("/api/compile/lexical", json={"source": huge_src}, headers=self.ali)
        self.assertEqual(r.status_code, 413)

    def test_public_registration_always_assigns_user_role(self):
        from contextlib import contextmanager
        import sqlite3
        from unittest.mock import patch
        from app.db import SQLITE_SCHEMA
        from app.routes.auth import register, Credentials

        mem_conn = sqlite3.connect(":memory:")
        mem_conn.row_factory = sqlite3.Row
        mem_conn.executescript(SQLITE_SCHEMA)

        @contextmanager
        def mem_connect():
            yield mem_conn

        with patch("app.routes.auth.connect", mem_connect), patch("app.routes.auth.logs.record"):
            res1 = register(Credentials(username="first_visitor", password="password123"))
            self.assertEqual(res1["user"]["role"], "user")
            res2 = register(Credentials(username="second_dev", password="password123"))
            self.assertEqual(res2["user"]["role"], "user")

        mem_conn.close()


if __name__ == "__main__":
    unittest.main()





