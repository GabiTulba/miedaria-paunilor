#!/usr/bin/env python3
"""Miedăria Păunilor label service: renders bottle labels with the artwork
library (the `artwork` submodule) for the shop's admin label tool.

Only the backend calls it, over an internal Docker network with no other
members and no internet access; the backend authenticates the admin and
types the request before forwarding it. JSON over HTTP:

    GET  /health    200 "ok"
    GET  /sizes     the label formats: [{name, front_mm, back_mm, bottle, volume_cl}]
    POST /preview   {size, front?, back?} -> {front, back}: each side's finished-look
                    SVG and dropped extras, or why it can't be made (an invalid
                    field or a render error)
    POST /bundle    {sizes, front?, back?} -> application/zip of every label, layer
                    and A4 sheet (SVG + PDF)

Invalid input answers 422 `{code: "invalid_field", field, problem, detail}`;
a bundle that can't be made answers 422 with the render error (see
render.RenderError). Renders run one at a time.
"""
import json
import logging
import os
import sys
import threading
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ARTWORK = Path(__file__).resolve().parent / 'artwork'
sys.path[:0] = [str(ARTWORK), str(ARTWORK / 'generators')]

import content  # noqa: E402
import render  # noqa: E402
from lib import SIZES  # noqa: E402

MAX_BODY_BYTES = 64 * 1024
REQUEST_TIMEOUT_SECS = 30
SIZES_JSON = json.dumps([{'name': s.name, 'front_mm': s.front_mm, 'back_mm': s.back_mm, 'bottle': s.bottle,
                          'volume_cl': s.volume_cl} for s in SIZES.values()]).encode()

render_lock = threading.Lock()
log = logging.getLogger('labels')


class BadRequest(Exception):
    pass


class Handler(BaseHTTPRequestHandler):
    server_version = 'labels'
    timeout = REQUEST_TIMEOUT_SECS

    def do_GET(self):
        if self.path == '/health':
            self._send(HTTPStatus.OK, b'ok', 'text/plain')
        elif self.path == '/sizes':
            self._send(HTTPStatus.OK, SIZES_JSON, 'application/json')
        else:
            self._send_json(HTTPStatus.NOT_FOUND, {'code': 'not_found'})

    def do_POST(self):
        routes = {'/preview': self._preview, '/bundle': self._bundle}
        route = routes.get(self.path)
        if route is None:
            self._send_json(HTTPStatus.NOT_FOUND, {'code': 'not_found'})
            return
        try:
            route(self._json_body())
        except BadRequest as error:
            self._send_json(HTTPStatus.BAD_REQUEST, {'code': 'bad_request', 'detail': str(error)})
        except content.InvalidField as error:
            self._send_json(HTTPStatus.UNPROCESSABLE_ENTITY, error.to_json())
        except render.RenderError as error:
            self._send_json(HTTPStatus.UNPROCESSABLE_ENTITY, error.to_json())
        except Exception:
            log.exception('render failed')
            self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {'code': 'internal'})

    def _preview(self, body):
        size, raw_sides = content.preview_request(body)
        with render_lock:
            result = render.preview(size, raw_sides)
        self._send_json(HTTPStatus.OK, result)

    def _bundle(self, body):
        sizes, contents = content.bundle_request(body)
        with render_lock:
            archive = render.bundle(sizes, contents)
        self._send(HTTPStatus.OK, archive, 'application/zip')

    def _json_body(self):
        if self.headers.get_content_type() != 'application/json':
            raise BadRequest('expected application/json')
        try:
            length = int(self.headers.get('Content-Length', ''))
        except ValueError:
            raise BadRequest('missing Content-Length') from None
        if not 0 < length <= MAX_BODY_BYTES:
            raise BadRequest(f'body must be 1 to {MAX_BODY_BYTES} bytes')
        try:
            return json.loads(self.rfile.read(length))
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise BadRequest('invalid JSON') from None

    def _send_json(self, status, payload):
        self._send(status, json.dumps(payload).encode(), 'application/json')

    def _send(self, status, body, content_type):
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        log.info('%s %s', self.address_string(), format % args)


def main():
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(name)s: %(message)s')
    port = int(os.environ.get('LABELS_PORT', '8080'))
    server = ThreadingHTTPServer(('0.0.0.0', port), Handler)
    log.info('listening on port %d', port)
    server.serve_forever()


if __name__ == '__main__':
    main()
