import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "./build.mjs";

const registry = new URL("../__fixtures__/registry", import.meta.url).pathname;
const brokenRegistry = new URL("../__fixtures__/broken-link", import.meta.url).pathname;

const exists = async (path) => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

async function withDist(fn) {
  const distDir = await mkdtemp(join(tmpdir(), "learning-build-"));
  try {
    return await fn(distDir);
  } finally {
    await rm(distDir, { recursive: true, force: true });
  }
}

test("build produces home, landing, lesson, assessment, app and metadata", async () => {
  await withDist(async (distDir) => {
    const { courses } = await build({ rootDir: registry, distDir });
    assert.deepEqual(courses.map((c) => c.slug), ["demo-course", "second-course"]);

    for (const file of [
      "index.html",
      "courses/demo-course/index.html",
      "courses/demo-course/app/index.html",
      "courses/second-course/index.html",
      "courses/second-course/01-intro.html",
      "courses/second-course/a/check.html",
      "assets/shell.css",
      "assets/shell.js",
      "assets/assessment.js",
      "assets/assessment-core.mjs",
      "sitemap.xml",
      "robots.txt",
      "404.html",
      "search-index.json",
      "build.json",
    ]) {
      assert.ok(await exists(join(distDir, file)), file);
    }

    const sitemap = await readFile(join(distDir, "sitemap.xml"), "utf8");
    assert.ok(sitemap.includes("/courses/demo-course/"));
    assert.ok(sitemap.includes("/courses/second-course/"));
    assert.ok(!sitemap.includes("draft-course"));

    const manifest = JSON.parse(await readFile(join(distDir, "build.json"), "utf8"));
    assert.deepEqual(manifest.courses.map((c) => c.slug), ["demo-course", "second-course"]);
    assert.equal(manifest.courses[1].lessons, 1);
  });
});

test("build fails loudly on a broken internal link", async () => {
  await withDist(async (distDir) => {
    await assert.rejects(() => build({ rootDir: brokenRegistry, distDir }), /broken link/i);
  });
});

test("build fails on a manifest error instead of shipping half a course", async () => {
  await withDist(async (distDir) => {
    await assert.rejects(
      () => build({ rootDir: new URL("../__fixtures__/broken", import.meta.url).pathname, distDir }),
      /reserved slug assets|duplicate slug/,
    );
  });
});
