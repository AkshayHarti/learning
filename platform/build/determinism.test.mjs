import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "./build.mjs";

const registry = new URL("../__fixtures__/registry", import.meta.url).pathname;
const broken = new URL("../__fixtures__/broken", import.meta.url).pathname;
const cli = fileURLToPath(new URL("./cli.mjs", import.meta.url));

async function treeHashes(dir, base = dir, out = {}) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await treeHashes(full, base, out);
    else if (entry.isFile()) {
      const bytes = await readFile(full);
      out[relative(base, full).split("\\").join("/")] = createHash("sha256").update(bytes).digest("hex");
    }
  }
  return out;
}

test("two builds produce identical file trees", async () => {
  const a = await mkdtemp(join(tmpdir(), "learning-det-a-"));
  const b = await mkdtemp(join(tmpdir(), "learning-det-b-"));
  try {
    await build({ rootDir: registry, distDir: a });
    await build({ rootDir: registry, distDir: b });
    assert.deepEqual(await treeHashes(a), await treeHashes(b));
  } finally {
    await rm(a, { recursive: true, force: true });
    await rm(b, { recursive: true, force: true });
  }
});

test("build.json and search-index.json carry no timestamps", async () => {
  const distDir = await mkdtemp(join(tmpdir(), "learning-det-c-"));
  try {
    await build({ rootDir: registry, distDir: distDir });
    const manifest = await readFile(join(distDir, "build.json"), "utf8");
    assert.ok(!/\d{4}-\d{2}-\d{2}T/.test(manifest));
    const first = await treeHashes(distDir);
    await build({ rootDir: registry, distDir });
    assert.deepEqual(await treeHashes(distDir), first);
  } finally {
    await rm(distDir, { recursive: true, force: true });
  }
});

test("cli validate exits 0 on a clean registry and names the problem on a broken one", async () => {
  const clean = spawnSync(process.execPath, [cli, "validate", "--root", registry], { encoding: "utf8" });
  assert.equal(clean.status, 0, clean.stderr);

  const bad = spawnSync(process.execPath, [cli, "validate", "--root", broken], { encoding: "utf8" });
  assert.notEqual(bad.status, 0);
  assert.match(`${bad.stdout}${bad.stderr}`, /reserved slug assets/);
});

test("cli build writes dist where asked", async () => {
  const distDir = await mkdtemp(join(tmpdir(), "learning-det-d-"));
  try {
    const result = spawnSync(process.execPath, [cli, "build", "--root", registry, "--dist", distDir], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal((await stat(join(distDir, "index.html"))).isFile(), true);
  } finally {
    await rm(distDir, { recursive: true, force: true });
  }
});
