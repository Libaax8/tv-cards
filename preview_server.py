"""Local preview of the couch-tv home with the cards from cards.json. Changes nothing in couch-tv.

It serves couch-tv/tv-home/web as it is, except that the preview's sample cards (in mock.js) are
swapped for the ones make_cards.py wrote. It also serves /cards.json with the header a TV needs.

Run:  python preview_server.py   then open  http://127.0.0.1:8765/index.html?mock=1&cards=1
"""
import http.server
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(HERE, "..", "couch-tv", "tv-home", "web")
SAMPLE = re.compile(r'cards: arg\("cards"\) \? \[[\s\S]*?\] : \[\]')


def cards():
    subprocess.run([sys.executable, os.path.join(HERE, "make_cards.py")], check=False)
    with open(os.path.join(HERE, "cards.json"), encoding="utf-8") as f:
        return json.load(f)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=WEB, **kw)

    def _send(self, body, kind):
        body = body.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", kind + "; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/cards.json":
            return self._send(json.dumps(cards(), ensure_ascii=False), "application/json")
        if path == "/mock.js":
            with open(os.path.join(WEB, "mock.js"), encoding="utf-8") as f:
                src = f.read()
            new = "cards: " + json.dumps(cards()["cards"])
            return self._send(SAMPLE.sub(lambda m: new, src), "application/javascript")
        return super().do_GET()


if __name__ == "__main__":
    http.server.ThreadingHTTPServer(("127.0.0.1", 8765), Handler).serve_forever()
