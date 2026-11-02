#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/.."

# Root validation covers the language-neutral wrapper scripts plus the default
# TypeScript stack. Run stack-local check-all scripts after selecting extras.
./scripts/lint.sh
./scripts/typecheck.sh
./scripts/test.sh
bun run build

# Art conformance: palette and grid. Needs python3 + Pillow (see tools/art/README.md).
python3 -m unittest discover -s tools/art
python3 tools/art/verify.py packs/
