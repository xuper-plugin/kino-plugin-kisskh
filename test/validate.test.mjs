import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test("the kit's validate accepts the manifest and the built entry", () => {
  const build = spawnSync("npm", ["run", "build"], { cwd: root, encoding: "utf8" });
  assert.equal(build.status, 0, build.stderr);
  const r = spawnSync("node", ["sdk/validate.mjs", ".", "--repo", "xuper-plugin/kino-plugin-kisskh"], { cwd: root, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr + r.stdout);
});
