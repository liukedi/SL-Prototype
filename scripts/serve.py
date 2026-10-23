#!/usr/bin/env python3
"""Local dev server for the prototype.

Serves the project folder on all network interfaces with caching disabled (so edits
show up on reload) and prints the URL to open on a phone on the same Wi-Fi.

Usage:  python3 scripts/serve.py [port]
"""
import http.server, os, socket, sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))  # no packet is sent; just picks the LAN interface
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


if __name__ == "__main__":
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    with http.server.ThreadingHTTPServer(("0.0.0.0", PORT), NoCacheHandler) as httpd:
        print(f"On this computer:  http://localhost:{PORT}")
        print(f"On your phone:     http://{lan_ip()}:{PORT}   (same Wi-Fi network)")
        httpd.serve_forever()
