import test from "node:test";
import assert from "node:assert/strict";
import { discoverCourses } from "./discover.mjs";

const root = new URL("../__fixtures__/registry", import.meta.url).pathname;
const broken = new URL("../__fixtures__/broken", import.meta.url).pathname;

test("parses a valid course and fills defaults", async () => {
  const { courses, errors } = await discoverCourses({ rootDir: root });
  assert.deepEqual(errors, []);
  const demo = courses.find((c) => c.slug === "demo-course");
  assert.equal(demo.kind, "app");
  assert.equal(demo.app.entry, "index.html");
  assert.equal(demo.app.mountDir, "app");
  assert.equal(demo.app.build, null);
  assert.equal(demo.progressKey, "learning:demo-course:v1");
  assert.deepEqual(demo.contents, []);
  assert.deepEqual(demo.assessments, []);
  assert.equal(demo.status, "live");
});

test("sorts live courses by order and drops drafts", async () => {
  const { courses } = await discoverCourses({ rootDir: root });
  assert.deepEqual(courses.map((c) => c.slug), ["demo-course", "second-course"]);
});

test("rejects duplicate slug, slug/dir mismatch, missing entry and reserved slug", async () => {
  const { errors } = await discoverCourses({ rootDir: broken });
  assert.ok(errors.some((e) => e.includes("duplicate slug demo-course")), errors.join("\n"));
  assert.ok(errors.some((e) => e.includes("does not match directory")), errors.join("\n"));
  assert.ok(errors.some((e) => e.includes("missing app entry index.html")), errors.join("\n"));
  assert.ok(errors.some((e) => e.includes("reserved slug assets")), errors.join("\n"));
});

test("a contents href pointing at another course is left for the link checker", async () => {
  const { courses, errors } = await discoverCourses({ rootDir: root });
  assert.deepEqual(errors, []);
  const second = courses.find((c) => c.slug === "second-course");
  assert.ok(
    second.contents.some((item) => item.href === "/courses/demo-course/app/index.html"),
    "fixture should cross-link",
  );
});

test("a kind/content mismatch is an error naming the file and field", async () => {
  const { errors } = await discoverCourses({ rootDir: broken });
  assert.ok(errors.some((e) => e.includes("lessons") && e.includes("does not exist")), errors.join("\n"));
});

test("discovery never throws on malformed json", async () => {
  const { courses, errors } = await discoverCourses({
    rootDir: new URL("../__fixtures__/malformed", import.meta.url).pathname,
  });
  assert.deepEqual(courses, []);
  assert.equal(errors.length, 1);
  assert.ok(errors[0].includes("courses/bad/course.json"));
});

test("an unknown manifest key is an error, not silently ignored", async () => {
  const { mkdtemp, mkdir, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = await mkdtemp(join(tmpdir(), "learning-strict-"));

  try {
    await mkdir(join(dir, "courses", "typo-course"), { recursive: true });
    await writeFile(
      join(dir, "courses", "typo-course", "course.json"),
      JSON.stringify({
        slug: "typo-course",
        title: "Typo",
        promise: "A manifest with a misspelled field.",
        kind: "app",
        order: 1,
        app: { entry: "index.html", bulid: "vite" },
      }),
    );

    const { courses, errors } = await discoverCourses({ rootDir: dir });
    assert.deepEqual(courses, []);
    // A typo must fail the build: silently stripped keys publish a course with
    // the behaviour the author did not ask for.
    assert.ok(errors.some((e) => e.includes("bulid")), errors.join("\n"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
