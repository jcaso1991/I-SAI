import os
import http.server
import socketserver

PORT = int(os.environ.get("PORT", "8000"))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.dirname(__file__), **kwargs)

httpd = socketserver.TCPServer(("0.0.0.0", PORT), Handler)
print(f"Serving portfolio on 0.0.0.0:{PORT}")
httpd.serve_forever()
