#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
if command -v python3 >/dev/null 2>&1; then
  echo 'Open http://127.0.0.1:4173/ ; press Ctrl+C to stop.'
  exec python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
fi
printf 'Python 3 is not installed. You may instead open preview.html in a browser.\n' >&2
exit 1
