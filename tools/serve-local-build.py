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

    def do_GET(self):
        if not self.valid_request():
            return
        if self.path.startswith("/api/"):
            return self.proxy()
        file = Path(self.translate_path(self.path))
        if not file.exists() and "." not in self.path.rsplit("/", 1)[-1]:
            self.path = "/index.html"
        super().do_GET()

    def do_HEAD(self):
        if self.valid_request():
            super().do_HEAD()

    def do_POST(self):
        self.proxy()

    do_PUT = do_POST
    do_PATCH = do_POST
    do_DELETE = do_POST

    def proxy(self):
        if not self.valid_request():
            return
        if not self.path.startswith("/api/"):
            self.send_error(404)
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
            self.wfile.write(response.read())
        finally:
            connection.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=5184)
    args = parser.parse_args()
    if not (BUILD / "index.html").exists():
        parser.error("Run npm run build first")
    print(f"Local production fixture: http://127.0.0.1:{args.port}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()
