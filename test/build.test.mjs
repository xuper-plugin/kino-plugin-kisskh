import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test("npm run build emits the bundled plugin.js at the repo root", () => {
  rmSync(root + "plugin.js", { force: true });
  const r = spawnSync("npm", ["run", "build"], { cwd: root, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(root + "plugin.js"));
});
