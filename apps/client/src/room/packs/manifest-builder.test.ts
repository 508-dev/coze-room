import { execFileSync } from "node:child_process";
import { it } from "vitest";

it("builds the pack contract and keeps committed metadata in sync with art.json", () => {
  execFileSync("python3", [
    "-m",
    "unittest",
    "discover",
    "-s",
    "tools/art",
    "-p",
    "test_build_manifest.py",
  ]);
  execFileSync("python3", ["tools/art/build_manifest.py", "--check"]);
});
