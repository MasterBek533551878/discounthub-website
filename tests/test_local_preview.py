import http.client
import importlib.util
import json
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError, URLError


SPEC = importlib.util.spec_from_file_location("preview", Path(__file__).resolve().parents[1] / "scripts" / "serve_webmcp.py")
preview = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(preview)


class LocalPreviewTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / "deals").mkdir()
        (self.root / "deals" / "index.html").write_text("<h1>DiscountHub</h1>", encoding="utf-8")
        self.script = f"const API = '{preview.API}';"
        (self.root / "script.js").write_text(self.script, encoding="utf-8")
        (self.root / "webmcp.js").write_text(self.script, encoding="utf-8")
        (self.root / ".env").write_text("fixture-private-content", encoding="utf-8")
        (self.root / "scripts").mkdir()
        (self.root / "scripts" / "secret.py").write_text("fixture-private-code", encoding="utf-8")
        self.calls = []
        self.failure = None
        self.server = preview.make_server(0, self.root, self.fetch)
        self.log = patch.object(preview.PreviewHandler, "log_message", lambda *args: None)
        self.log.start()
        self.thread = threading.Thread(target=self.server.serve_forever, kwargs={"poll_interval": 0.01}, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.log.stop()
        self.temp.cleanup()

    def fetch(self, url):
        self.calls.append(url)
        if self.failure:
            raise self.failure
        return json.dumps({"items": [{"id": "test-fixture"}], "total": 1}).encode()

    def request(self, path, method="GET", headers=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=2)
        conn.request(method, path, headers=headers or {})
        response = conn.getresponse()
        result = response.status, dict(response.getheaders()), response.read()
        conn.close()
        return result

    def test_html_is_unchanged_and_js_only_changes_in_served_copy(self):
        status, _, body = self.request("/deals/")
        self.assertEqual((status, body), (200, b"<h1>DiscountHub</h1>"))
        for name in ["script.js", "webmcp.js"]:
            status, headers, body = self.request(f"/{name}?v=test")
            self.assertEqual(status, 200)
            self.assertIn(f"http://127.0.0.1:{self.server.server_port}".encode(), body)
            self.assertEqual(headers["Cache-Control"], "no-store")
            self.assertEqual((self.root / name).read_text(), self.script)
        self.assertEqual(self.calls, [])

    def test_public_api_query_uses_fixed_upstream_and_returns_json(self):
        status, headers, body = self.request("/deals?q=headphones&min_discount=20", headers={"Cookie": "test-cookie", "Authorization": "test-token"})
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["total"], 1)
        self.assertEqual(self.calls, [preview.API + "/deals?q=headphones&min_discount=20"])
        self.assertEqual(headers["Content-Type"], "application/json; charset=utf-8")

    def test_promotion_facets_and_details_are_available(self):
        for path in ["/promotions", "/promotions/stores", "/promotions/countries", "/deals/facets", "/partner-offers", "/partner-offers/categories", "/promotions/awin%3A123"]:
            self.assertEqual(self.request(path)[0], 200)
        self.assertEqual(len(self.calls), 7)

    def test_click_redirects_without_making_a_server_side_click(self):
        status, headers, _ = self.request("/deals/awin%3A123/click")
        self.assertEqual(status, 302)
        self.assertEqual(headers["Location"], preview.API + "/deals/awin%3A123/click")
        self.assertEqual(self.calls, [])

    def test_admin_secrets_traversal_and_remote_origins_are_rejected(self):
        for path in ["/admin", "/admin/providers", "/.env", "/.git/config", "/%2e%2e/.env", "/scripts/secret.py", "/scripts/", "http://example.com/deals"]:
            self.assertIn(self.request(path)[0], [403, 404])
        self.assertEqual(self.request("/deals", headers={"Host": "example.com"})[0], 403)
        self.assertEqual(self.request("/deals", headers={"Origin": "https://example.com"})[0], 403)
        self.assertEqual(self.calls, [])

    def test_methods_do_not_write_to_upstream(self):
        for method in ["POST", "PUT", "DELETE", "OPTIONS", "HEAD"]:
            self.assertIn(self.request("/deals", method)[0], [405, 501])
        self.assertEqual(self.calls, [])

    def test_upstream_failures_are_not_empty_successes(self):
        self.failure = HTTPError(preview.API, 429, "rate limited", None, None)
        self.assertEqual(self.request("/deals")[0], 429)
        self.failure = URLError("timeout")
        self.assertEqual(self.request("/deals")[0], 502)


if __name__ == "__main__":
    unittest.main()
