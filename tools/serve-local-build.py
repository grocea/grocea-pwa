"""Loopback-only production-build fixture server, with a fixed loopback API proxy.
Run after npm run build: python3 tools/serve-local-build.py --port 5184
This is local verification tooling, not a deployment server.
"""
from __future__ import annotations

import argparse
import http.client
from urllib.parse import unquote, urlsplit
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

BUILD = Path(__file__).resolve().parents[1] / "dist"
API_OUTAGE_MARKER = None


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BUILD), **kwargs)

    def log_message(self, format, *args):
        pass  # Do not write URLs, tokens, cookies or account content to logs.

    def valid_request(self):
        host = urlsplit("http://" + self.headers.get("Host", "")).hostname
        path = unquote(urlsplit(self.path).path)
        if host not in {"127.0.0.1", "localhost", "::1"} or not path.startswith("/") or path.startswith("//"):
            self.send_error(400)
            return False
        if any(part in {".", ".."} for part in path.split("/")) or "\\" in path:
            self.send_error(400)
            return False
        return True

    def guess_type(self, path):
        if (BUILD / 'wrong-mime-fixture').exists() and str(path).endswith('.js') and '/assets/' in str(path):
            return 'application/json'
        return super().guess_type(path)

    def end_headers(self):
        path = urlsplit(self.path).path
        if path.startswith('/assets/'):
            self.send_header('Cache-Control', 'public, max-age=31536000, immutable')
        elif path in {'/', '/sw.js', '/index.html'}:
            self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def do_GET(self):
        if not self.valid_request():
            return
        path = urlsplit(self.path).path
        if path == "/api" or path.startswith("/api/"):
            return self.proxy()
        if path == "/index.html":
            # Match Cloudflare assets html_handling, which redirects to the canonical URL.
            self.send_response(307)
            self.send_header("Location", "/")
            self.end_headers()
            return
        # A/B fixtures can have equal second-resolution mtimes and lengths.
        # Never answer 304 for mutable shell/worker using mtime alone.
        if path in {'/', '/index.html', '/sw.js'}:
            for header in ('If-Modified-Since', 'If-None-Match'):
                if header in self.headers:
                    del self.headers[header]
        file = Path(self.translate_path(self.path))
        if not file.exists() and self.headers.get("Sec-Fetch-Mode") == "navigate":
            self.path = "/index.html"
        super().do_GET()

    def do_HEAD(self):
        if not self.valid_request():
            return
        path = urlsplit(self.path).path
        if path == "/api" or path.startswith("/api/"):
            return self.proxy()
        super().do_HEAD()

    def do_POST(self):
        self.proxy()

    do_PUT = do_POST
    do_PATCH = do_POST
    do_DELETE = do_POST

    def proxy(self):
        if not self.valid_request():
            return
        path = urlsplit(self.path).path
        if path != "/api" and not path.startswith("/api/"):
            self.send_error(404)
            return
        if API_OUTAGE_MARKER and API_OUTAGE_MARKER.exists() and self.command not in {"GET", "HEAD"}:
            self.send_error(503, "Synthetic local API outage")
            return
        connection = http.client.HTTPConnection("127.0.0.1", 8000, timeout=20)
        try:
            body = self.rfile.read(int(self.headers.get("Content-Length", "0")))
            headers = {key: value for key, value in self.headers.items() if key.lower() not in {"host", "connection"}}
            connection.request(self.command, self.path, body=body, headers=headers)
            response = connection.getresponse()
            if 300 <= response.status < 400:
                self.send_error(502, "API redirects are disabled in local verification")
                return
            self.send_response(response.status)
            for key, value in response.getheaders():
                if key.lower() not in {"transfer-encoding", "connection", "server", "date"}:
                    self.send_header(key, value)
            self.end_headers()
            content = response.read()
            if self.command != "HEAD":
                self.wfile.write(content)
        finally:
            connection.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=5184)
    parser.add_argument("--build", type=Path, default=BUILD, help="Explicit production output directory (can be an atomically switched symlink)")
    parser.add_argument("--api-outage-marker", type=Path)
    args = parser.parse_args()
    BUILD = args.build.absolute()
    API_OUTAGE_MARKER = args.api_outage_marker
    if not (BUILD / "index.html").exists():
        parser.error("Run npm run build first")
    print(f"Local production fixture: http://127.0.0.1:{args.port}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()
