#!/usr/bin/env python3
"""Serves the Ball on localhost and tells the browser never to keep an old copy."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class NoCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


ThreadingHTTPServer(("127.0.0.1", 8642), partial(NoCache, directory=str(Path(__file__).parent))).serve_forever()
