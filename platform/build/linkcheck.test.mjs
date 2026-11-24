import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkLinks } from "./linkcheck.mjs";

const exists = async (path) => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

test("linkcheck reports a missing asset and ignores hash, mailto and external links", async () => {
  const distDir = new URL("../__fixtures__/broken-link", import.meta.url).pathname;
  const { broken } = await checkLinks({ distDir: join(distDir, "courses/x-app/app") });
  assert.deepEqual(broken, [{ page: "index.html", href: "assets/missing.css" }]);
});

test("linkcheck accepts a directory URL that resolves to index.html", async () => {
  const distDir = await mkdtemp(join(tmpdir(), "learning-links-"));
  const { writeFile, mkdir } = await import("node:fs/promises");
  try {
    await mkdir(join(distDir, "courses/x"), { recursive: true });
    await writeFile(join(distDir, "courses/x/index.html"), '<a href="/courses/x/">self</a>');
    await writeFile(join(distDir, "index.html"), '<a href="/courses/x/">landing</a><img src="nope.png">');
    const { ok, broken } = await checkLinks({ distDir });
    assert.equal(ok, false);
    assert.deepEqual(broken, [{ page: "index.html", href: "nope.png" }]);
  } finally {
    await rm(distDir, { recursive: true, force: true });
  }
});

test("linkcheck checks url() references inside stylesheets", async () => {
  const distDir = await mkdtemp(join(tmpdir(), "learning-links-"));
  const { writeFile, mkdir } = await import("node:fs/promises");
  try {
    await mkdir(join(distDir, "assets"), { recursive: true });
    await writeFile(join(distDir, "index.html"), '<link rel="stylesheet" href="assets/a.css">');
    await writeFile(join(distDir, "assets/a.css"), ".x{background:url(gone.png)}");
    const { broken } = await checkLinks({ distDir });
    assert.deepEqual(broken, [{ page: "assets/a.css", href: "gone.png" }]);
    assert.ok(await exists(join(distDir, "index.html")));
  } finally {
    await rm(distDir, { recursive: true, force: true });
  }
});

test("a clean tree reports ok with no broken entries", async () => {
  const distDir = await mkdtemp(join(tmpdir(), "learning-links-"));
  const { writeFile } = await import("node:fs/promises");
  try {
    await writeFile(join(distDir, "index.html"), '<a href="/">home</a>');
    const { ok, broken } = await checkLinks({ distDir });
    assert.equal(ok, true);
    assert.deepEqual(broken, []);
    assert.ok((await readFile(join(distDir, "index.html"), "utf8")).includes("home"));
  } finally {
    await rm(distDir, { recursive: true, force: true });
  }
});
