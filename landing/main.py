import os
import html
import http.server
import socketserver

PORT = int(os.environ.get("PORT", "8000"))
FRONTEND_URL = os.environ.get("FRONTEND_URL", "#").rstrip("/") or "#"
ROOT_DIR = os.path.dirname(__file__)

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT_DIR, **kwargs)

    def do_GET(self):
        if self.path.split("?", 1)[0] in ("/", "/index.html"):
            with open(os.path.join(ROOT_DIR, "index.html"), "r", encoding="utf-8") as f:
                body = f.read().replace("{{FRONTEND_URL}}", html.escape(FRONTEND_URL, quote=True))
            data = body.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        super().do_GET()

class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True

httpd = ReusableTCPServer(("0.0.0.0", PORT), Handler)
print(f"Serving portfolio on 0.0.0.0:{PORT}")
httpd.serve_forever()
