import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mountApp } from "./mount-app.mjs";

const fixtures = new URL("../__fixtures__/mount", import.meta.url).pathname;

const sha = async (path) => createHash("sha256").update(await readFile(path)).digest("hex");
const exists = async (path) => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

const indexCourse = {
  slug: "app-course",
  app: { entry: "index.html", build: null, mountDir: "app" },
  dir: join(fixtures, "app-course"),
};

const namedEntryCourse = {
  slug: "named-entry",
  app: { entry: "course.html", build: null, mountDir: "app" },
  dir: join(fixtures, "named-entry"),
};

test("copies files byte-identical except one injected pill per html file", async () => {
  const distDir = await mkdtemp(join(tmpdir(), "learning-mount-"));
  try {
    const { files } = await mountApp({ course: indexCourse, distDir });
    assert.ok(files >= 3, `expected at least 3 files, got ${files}`);

    for (const asset of ["assets/app.js", "assets/app.css"]) {
      assert.equal(
        await sha(join(distDir, "courses/app-course/app", asset)),
        await sha(join(fixtures, "app-course/app", asset)),
        asset,
      );
    }

    const html = await readFile(join(distDir, "courses/app-course/app/index.html"), "utf8");
    assert.equal(html.split("<!--learning-pill-->").length - 1, 1);
    assert.equal(html.split('<a class="learning-pill"').length - 1, 1);
    assert.ok(html.indexOf('<a class="learning-pill"') > html.lastIndexOf("<article"));
  } finally {
    await rm(distDir, { recursive: true, force: true });
  }
});

test("mounting twice does not inject a second pill", async () => {
  const distDir = await mkdtemp(join(tmpdir(), "learning-mount-"));
  try {
    await mountApp({ course: indexCourse, distDir });
    await mountApp({ course: indexCourse, distDir });
    const html = await readFile(join(distDir, "courses/app-course/app/index.html"), "utf8");
    assert.equal(html.split("<!--learning-pill-->").length - 1, 1);
  } finally {
    await rm(distDir, { recursive: true, force: true });
  }
});

test("writes a redirect when entry is not index.html", async () => {
  const distDir = await mkdtemp(join(tmpdir(), "learning-mount-"));
  try {
    await mountApp({ course: namedEntryCourse, distDir });
    const path = join(distDir, "courses/named-entry/app/index.html");
    assert.ok(await exists(path));
    const html = await readFile(path, "utf8");
    assert.ok(html.includes('http-equiv="refresh"'));
    assert.ok(html.includes("course.html"));
    assert.ok(html.includes("<a href=\"course.html\""));
  } finally {
    await rm(distDir, { recursive: true, force: true });
  }
});

test("a course without an app mounts nothing", async () => {
  const distDir = await mkdtemp(join(tmpdir(), "learning-mount-"));
  try {
    const result = await mountApp({ course: { slug: "x", app: null, dir: fixtures }, distDir });
    assert.deepEqual(result, { files: 0 });
  } finally {
    await rm(distDir, { recursive: true, force: true });
  }
});

test("sourceDir mounts build output and skips sources, node_modules and dist", async () => {
  const sourceDir = await mkdtemp(join(tmpdir(), "learning-src-"));
  const distDir = await mkdtemp(join(tmpdir(), "learning-mount-"));
  const { mkdir, writeFile } = await import("node:fs/promises");
  try {
    await mkdir(join(sourceDir, "assets"), { recursive: true });
    await mkdir(join(sourceDir, "node_modules/pkg"), { recursive: true });
    await mkdir(join(sourceDir, "dist"), { recursive: true });
    await writeFile(join(sourceDir, "index.html"), "<!doctype html><html><body><h1>Built</h1></body></html>");
    await writeFile(join(sourceDir, "assets/main.js"), "console.log(1)");
    await writeFile(join(sourceDir, "node_modules/pkg/index.js"), "nope");
    await writeFile(join(sourceDir, "dist/stale.js"), "nope");

    const { files } = await mountApp({ course: indexCourse, distDir, sourceDir });
    assert.equal(files, 2);
    assert.ok(await exists(join(distDir, "courses/app-course/app/assets/main.js")));
    assert.ok(!(await exists(join(distDir, "courses/app-course/app/node_modules"))));
    assert.ok(!(await exists(join(distDir, "courses/app-course/app/dist"))));
  } finally {
    await rm(sourceDir, { recursive: true, force: true });
    await rm(distDir, { recursive: true, force: true });
  }
});
