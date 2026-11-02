#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/.."

# Build the client for production. `vite build` runs with MODE=production, so
# import.meta.env.DEV is false and the shared API-base helper resolves to the
# page's own origin (or VITE_API_BASE_URL) instead of the localhost dev default.
bun run build

# The production bundle must contain no localhost API base. The deploy serves
# the client, the /rooms REST endpoints, and the /ws WebSocket on one origin, so
# any 127.0.0.1 or localhost string in the emitted assets means a call would
# target the visitor's own machine and fail with "connection refused".
#
# Scanned over the whole dist (not just assets/) because the requirement is
# "allowing nothing". `-I` skips binary files (PNG/OGG/M4A), where an accidental
# byte sequence cannot be a network call and where grep would otherwise report
# spurious "Binary file matches" lines.
if grep -rInE '127\.0\.0\.1|localhost' apps/client/dist; then
  echo "Production bundle references a localhost API base (see above)." >&2
  exit 1
fi

echo "Production bundle is free of localhost references."
