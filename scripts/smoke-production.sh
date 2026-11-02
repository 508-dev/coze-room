#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/.."

IMAGE="${IMAGE:-dormouse-production-smoke}"
CONTAINER="dormouse-production-smoke-$$"

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

docker build --tag "$IMAGE" .
docker run --detach --rm --name "$CONTAINER" --publish 127.0.0.1::3000 "$IMAGE" >/dev/null

PORT_MAPPING="$(docker port "$CONTAINER" 3000/tcp | sed -n '1p')"
PORT="${PORT_MAPPING##*:}"
BASE_URL="http://127.0.0.1:${PORT}"

attempt=0
while [ "$attempt" -lt 30 ]; do
  if HEALTH="$(curl --fail --silent "${BASE_URL}/health" 2>/dev/null)"; then
    break
  fi
  attempt=$((attempt + 1))
  sleep 1
done

if [ "${HEALTH:-}" = "" ]; then
  echo "Production container did not become healthy. Logs:" >&2
  docker logs "$CONTAINER" >&2 || true
  exit 1
fi

printf '%s' "$HEALTH" | bun -e 'const health = JSON.parse(await Bun.stdin.text()); if (health.ok !== true) throw new Error("health is not ok");'
echo "Health: ok"

LOGS="$(docker logs "$CONTAINER" 2>&1)"
if printf '%s' "$LOGS" | grep -Eiq 'ERR_MODULE_NOT_FOUND|Cannot find module|ModuleNotFoundError'; then
  echo "Production container has an import error:" >&2
  printf '%s\n' "$LOGS" >&2
  exit 1
fi
printf '%s' "$LOGS" | grep -F 'dormouse server listening on http://0.0.0.0:3000' >/dev/null
echo "Server startup: ok"

curl --fail --silent --show-error "${BASE_URL}/packs/dormouse-v0/manifest.json" |
  bun -e 'const manifest = JSON.parse(await Bun.stdin.text()); if (manifest.id !== "dormouse-v0") throw new Error("unexpected pack manifest");'
echo "Pack manifest: ok"

curl --fail --silent --show-error "${BASE_URL}/packs/dormouse-v0/room.png" |
  bun -e '
const bytes = new Uint8Array(await Bun.stdin.arrayBuffer());
const signature = [137, 80, 78, 71, 13, 10, 26, 10];
if (bytes.length < signature.length || signature.some((byte, index) => bytes[index] !== byte)) {
  throw new Error("pack PNG is not real PNG data (possible unresolved Git LFS pointer)");
}
'
echo "Pack PNG: real PNG bytes"

BASE_URL="$BASE_URL" bun -e '
const url = new URL("/ws", process.env.BASE_URL);
url.protocol = "ws:";
await new Promise((resolve, reject) => {
  const socket = new WebSocket(url);
  const timeout = setTimeout(() => reject(new Error("WebSocket welcome timed out")), 5000);
  socket.addEventListener("open", () => {
    socket.send(JSON.stringify({
      t: "join",
      name: "production-smoke",
      look: { tone: 0, head: 0, top: 0, accessory: 0 },
    }));
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.t !== "welcome") return;
    clearTimeout(timeout);
    socket.close();
    resolve();
  });
  socket.addEventListener("error", () => {
    clearTimeout(timeout);
    reject(new Error("WebSocket connection failed"));
  });
});
'
echo "WebSocket: welcome"
echo "Production image smoke test passed."
