"""Local WebMCP preview with a fixed, public API proxy (Python 3.10+).

Run: py -3 scripts/serve_webmcp.py
Only the served copies of script.js and webmcp.js have their API origin
replaced. Files on disk and production URLs are unchanged.
"""

import argparse
import io
import json
import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import unquote, urlsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler


ROOT = Path(__file__).resolve().parents[1]
API = "https://api.discounthub.uz"
MAX_RESPONSE_BYTES = 2 * 1024 * 1024
STATIC_TYPES = {".html", ".css", ".js", ".png", ".jpg", ".jpeg", ".svg", ".webp", ".gif", ".ico", ".woff", ".woff2", ".ttf", ".xml", ".txt"}
PUBLIC_ROUTES = re.compile(
    r"^/(?:health|categories|marketplaces|deals(?:/facets|/[^/]+(?:/click)?)?"
    r"|promotions(?:/stores|/countries|/[^/]+(?:/click)?)?"
    r"|partner-offers(?:/categories|/[^/]+(?:/click)?)?)$"
)


class NoRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def fetch_public_json(url):
    request = Request(url, headers={"Accept": "application/json", "User-Agent": "DiscountHub-local-preview"})
    with build_opener(NoRedirects()).open(request, timeout=10) as response:
        body = response.read(MAX_RESPONSE_BYTES + 1)
        if len(body) > MAX_RESPONSE_BYTES:
            raise ValueError("API response exceeded the preview limit")
        json.loads(body)  # Do not serve an upstream HTML error page as a successful response.
        return body


class PreviewHandler(SimpleHTTPRequestHandler):
    def __init__(self, request, client_address, server):
        super().__init__(request, client_address, server, directory=str(server.root))

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def allowed_request(self):
        port = self.server.server_port
        hosts = {f"127.0.0.1:{port}", f"localhost:{port}"}
        host = self.headers.get("Host", "")
        origin = self.headers.get("Origin")
        parts = urlsplit(self.path)
        if host not in hosts or (origin is not None and origin != f"http://{host}") or parts.scheme or parts.netloc:
            self.send_error(403, "Use the local preview URL")
            return False
        try:
            decoded = unquote(parts.path, errors="strict")
        except UnicodeError:
            self.send_error(400, "Invalid path")
            return False
        if "\\" in decoded or any(part.startswith(".") for part in decoded.split("/") if part):
            self.send_error(403, "Path is not public")
            return False
        return True

    def send_head(self):
        path = Path(self.translate_path(self.path)).resolve()
        if not path.is_relative_to(self.server.root):
            self.send_error(403, "Path is not public")
            return None
        if path.is_dir():
            if not (path / "index.html").is_file():
                self.send_error(404, "Directory listing is disabled")
                return None
        elif path.suffix.lower() not in STATIC_TYPES:
            self.send_error(404, "Not a website asset")
            return None
        if path in {self.server.root / "script.js", self.server.root / "webmcp.js"}:
            if not path.is_file():
                self.send_error(404)
                return None
            local_origin = f"http://{self.headers['Host']}"
            content = path.read_text(encoding="utf-8").replace(API, local_origin).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/javascript; charset=utf-8")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            return io.BytesIO(content)
        return super().send_head()

    def do_GET(self):
        if not self.allowed_request():
            return
        path = urlsplit(self.path).path
        if not PUBLIC_ROUTES.fullmatch(path):
            return super().do_GET()
        target = API + self.path
        if path.endswith("/click"):
            # Preserve the normal click route; only a deliberate browser visit
            # follows it. Searches never fetch it through the proxy.
            self.send_response(302)
            self.send_header("Location", target)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        try:
            body = self.server.fetch_json(target)
        except HTTPError as error:
            self.send_error(error.code if 400 <= error.code < 600 else 502, "Public API request failed")
            return
        except (URLError, TimeoutError, OSError, ValueError):
            self.send_error(502, "Public API is unavailable; retry shortly")
            return
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_HEAD(self):
        if not self.allowed_request():
            return
        if PUBLIC_ROUTES.fullmatch(urlsplit(self.path).path):
            self.send_error(405, "Use GET for the public API")
            return
        super().do_HEAD()


def make_server(port=8767, root=ROOT, fetch_json=fetch_public_json):
    server = ThreadingHTTPServer(("127.0.0.1", port), PreviewHandler)
    server.root = Path(root).resolve()
    server.fetch_json = fetch_json
    return server


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8767)
    args = parser.parse_args()
    try:
        server = make_server(args.port)
    except OSError as error:
        raise SystemExit(f"Cannot start preview: {error}. Stop the previous server with Ctrl+C, then retry.") from error
    print(f"Open http://127.0.0.1:{server.server_port}/deals/", flush=True)
    print("Public API proxy enabled. Native WebMCP still requires a compatible browser. Ctrl+C to stop.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
