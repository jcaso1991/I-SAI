"""
Minimal stub for portfolio_view.

The original module generated a full HTML portfolio of the app. It was removed
from the repository at some point, but `server.py` still imports
`build_portfolio_html` and exposes `/api/portfolio`. To avoid a hard import
error on startup we expose a minimal placeholder that the server can still
import safely.
"""


def build_portfolio_html() -> str:
    """Return a tiny placeholder HTML page.

    Replace this with the full portfolio renderer when needed.
    """
    return (
        "<!doctype html>"
        "<html lang=\"es\"><head>"
        "<meta charset=\"utf-8\">"
        "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
        "<title>i-SAI — Portfolio</title>"
        "<style>"
        "body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"
        "background:#0f172a;color:#f8fafc;display:flex;align-items:center;justify-content:center;"
        "min-height:100vh;}"
        ".box{text-align:center;padding:40px;border-radius:16px;background:rgba(255,255,255,.05);"
        "box-shadow:0 8px 32px rgba(0,0,0,.3);max-width:560px;}"
        "h1{margin:0 0 12px;font-size:28px;font-weight:700;letter-spacing:-.5px;}"
        "p{margin:0;color:#94a3b8;line-height:1.5;}"
        "</style></head><body>"
        "<div class=\"box\">"
        "<h1>i-SAI</h1>"
        "<p>Portfolio temporalmente no disponible. "
        "Continúa la aplicación principal.</p>"
        "</div></body></html>"
    )
