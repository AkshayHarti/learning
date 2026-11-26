import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { discoverCourses } from "../platform/build/discover.mjs";
import { build } from "../platform/build/build.mjs";
import { newCourse, parseArgs } from "./new-course.mjs";

const cli = fileURLToPath(new URL("./new-course.mjs", import.meta.url));

/** An empty repo root: a courses/ directory and nothing in it. */
async function tmpRepo() {
  const root = await mkdtemp(join(tmpdir(), "learning-new-"));
  await mkdir(join(root, "courses"), { recursive: true });
  return root;
}

async function withRepo(fn) {
  const root = await tmpRepo();
  const dist = await mkdtemp(join(tmpdir(), "learning-new-dist-"));
  try {
    return await fn({ root, dist });
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(dist, { recursive: true, force: true });
  }
}

test("a new course is discovered, but ships nothing until it is live", async () => {
  await withRepo(async ({ root, dist }) => {
    await newCourse("graphs", { rootDir: root });

    const { courses, drafts, errors } = await discoverCourses({ rootDir: root });
    assert.deepEqual(errors, []);
    assert.deepEqual(courses.map((c) => c.slug), [], "a draft must not be live");
    assert.deepEqual(drafts.map((c) => c.slug), ["graphs"]);

    await build({ rootDir: root, distDir: dist });
    assert.ok(!existsSync(join(dist, "courses/graphs")), "draft rendered anyway");
    const manifest = JSON.parse(await readFile(join(dist, "build.json"), "utf8"));
    assert.deepEqual(manifest.courses, []);
  });
});

test("a live course appears in discovery with no other edits", async () => {
  await withRepo(async ({ root, dist }) => {
    await newCourse("graphs", { rootDir: root, live: true });

    const { courses, errors } = await discoverCourses({ rootDir: root });
    assert.deepEqual(errors, []);
    assert.ok(courses.some((c) => c.slug === "graphs"));

    await build({ rootDir: root, distDir: dist });
    for (const file of ["courses/graphs/index.html", "courses/graphs/01-intro.html", "courses/graphs/a/check.html"]) {
      assert.ok(existsSync(join(dist, file)), file);
    }

    const manifest = JSON.parse(await readFile(join(dist, "build.json"), "utf8"));
    assert.deepEqual(manifest.courses.map((c) => c.slug), ["graphs"]);
    assert.equal(manifest.courses[0].lessons, 1);
    assert.deepEqual(manifest.courses[0].assessments, [{ id: "check", engine: "items" }]);
  });
});

test("the new course takes a title and an order from its slug and its neighbours", async () => {
  await withRepo(async ({ root }) => {
    await mkdir(join(root, "courses/existing"), { recursive: true });
    await writeFile(
      join(root, "courses/existing/course.json"),
      JSON.stringify({
        slug: "existing",
        title: "Existing",
        promise: "Already here.",
        kind: "lessons",
        order: 30,
        lessons: { root: "lessons", order: [] },
      }),
    );

    const dir = await newCourse("my-graphs", { rootDir: root });
    const manifest = JSON.parse(await readFile(join(dir, "course.json"), "utf8"));
    assert.equal(manifest.slug, "my-graphs");
    assert.equal(manifest.title, "My graphs");
    assert.equal(manifest.order, 40, "order must not collide with the existing course");
    assert.equal(manifest.status, "draft");

    // The slug is rewritten everywhere it appears, not just in the manifest.
    for (const file of ["README.md", "lessons/01-intro.md", "assessments/check.json"]) {
      const text = await readFile(join(dir, file), "utf8");
      assert.ok(!text.includes("example-course"), `${file} still names the template slug`);
    }
  });
});

test("refuses an existing directory, a reserved slug and a malformed slug", async () => {
  await withRepo(async ({ root }) => {
    await newCourse("graphs", { rootDir: root });
    await assert.rejects(() => newCourse("graphs", { rootDir: root }), /already exists/);
    await assert.rejects(() => newCourse("assets", { rootDir: root }), /reserved/);
    await assert.rejects(() => newCourse("Graphs", { rootDir: root }), /slug/);
    await assert.rejects(() => newCourse("../escape", { rootDir: root }), /slug/);
  });
});

test("the cli reads a bare slug, which is how npm run passes it", () => {
  // Regression: `npm run new -- graphs` gives argv [node, script, "graphs"].
  // An index-arithmetic parser treated argv[2] as the --root value when --root
  // was absent and printed usage instead of scaffolding.
  const repoRoot = fileURLToPath(new URL("..", import.meta.url));
  const bare = parseArgs(["node", "scripts/new-course.mjs", "graphs"]);
  assert.equal(bare.slug, "graphs");
  assert.equal(bare.live, false);
  assert.equal(bare.root, repoRoot, "the default root is the repo the script lives in");

  assert.equal(parseArgs(["node", "s", "graphs", "--live"]).live, true);
  assert.equal(parseArgs(["node", "s", "--root", "/tmp/x", "graphs"]).root, "/tmp/x");
  assert.equal(parseArgs(["node", "s", "--root", "/tmp/x", "graphs"]).slug, "graphs");

  assert.throws(() => parseArgs(["node", "s", "--root"]), /--root needs/);
  assert.throws(() => parseArgs(["node", "s", "--nope", "graphs"]), /unknown option/);
  assert.throws(() => parseArgs(["node", "s", "one", "two"]), /unexpected argument/);
});

test("the cli exits non-zero and says why", async () => {
  await withRepo(async ({ root }) => {
    const ok = spawnSync(process.execPath, [cli, "graphs", "--root", root], { encoding: "utf8" });
    assert.equal(ok.status, 0, ok.stderr);
    assert.match(ok.stdout, /courses\/graphs/);

    const dup = spawnSync(process.execPath, [cli, "graphs", "--root", root], { encoding: "utf8" });
    assert.notEqual(dup.status, 0);
    assert.match(dup.stderr, /already exists/);

    const bad = spawnSync(process.execPath, [cli], { encoding: "utf8" });
    assert.notEqual(bad.status, 0);
    assert.match(bad.stderr, /usage/i);
  });
});
