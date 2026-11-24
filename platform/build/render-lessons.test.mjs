import test from "node:test";
import assert from "node:assert/strict";
import { parseFrontmatter } from "./frontmatter.mjs";
import { renderLesson, lessonHref, readLessons } from "./render-lessons.mjs";
import { courseWithLab, demoCourse } from "../__fixtures__/courses.mjs";

const lessonWith = (body, extra = {}) => ({ id: "01", title: "Intro", body, ...extra });

test("frontmatter scalars are parsed and stripped from the body", () => {
  const { data, body } = parseFrontmatter('---\ntitle: Week 1\nminutes: 300\nrun: "uv run pytest"\n---\n# H\n');
  assert.deepEqual(data, { title: "Week 1", minutes: "300", run: "uv run pytest" });
  assert.ok(body.startsWith("# H"));
});

test("a document without frontmatter is returned untouched", () => {
  const { data, body } = parseFrontmatter("# H\n\ntext\n");
  assert.deepEqual(data, {});
  assert.equal(body, "# H\n\ntext\n");
});

test("lesson renders TOC entries for h2 and h3 with stable ids", () => {
  const html = renderLesson({ course: demoCourse, lesson: lessonWith("## Derive\n### One\n## Build\n"), prev: null, next: null });
  assert.ok(html.includes('href="#derive"'));
  assert.ok(html.includes('id="build"'));
  assert.ok(html.includes('<nav class="toc"'));
});

test("repeated headings get unique ids and the TOC points at both", () => {
  const html = renderLesson({ course: demoCourse, lesson: lessonWith("## Setup\n## Setup\n"), prev: null, next: null });
  assert.ok(html.includes('id="setup"'));
  assert.ok(html.includes('id="setup-1"'));
  assert.ok(html.includes('href="#setup-1"'));
});

test("code inside markdown is escaped, never executed", () => {
  const html = renderLesson({
    course: demoCourse,
    lesson: lessonWith("```html\n<script>alert(1)</script>\n```\n"),
    prev: null,
    next: null,
  });
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(!html.includes("<script>alert(1)</script>"));
});

test("lab and solution panels render with the run command", () => {
  const html = renderLesson({
    course: courseWithLab,
    lesson: {
      id: "w01",
      title: "Week 1",
      body: "# Week 1\n",
      lab: "weeks/w01/lab.py",
      solution: "weeks/w01/solutions/lab.py",
      labCode: "def entropy():\n    pass\n",
      solutionCode: "def entropy():\n    return 0.0\n",
      run: "uv run pytest weeks/w01_prediction",
    },
    prev: null,
    next: { id: "w02", title: "Week 2" },
  });
  assert.ok(html.includes('class="code-panel"') && html.includes("data-copy"));
  assert.ok(html.includes("uv run pytest weeks/w01_prediction"));
  assert.ok(html.includes("def entropy():"));
  assert.ok(html.includes("return 0.0"));
  assert.ok(html.includes('href="/courses/lab-course/w02.html"'));
});

test("lessonHref is namespaced and prev/next cross weeks", () => {
  assert.equal(lessonHref(courseWithLab, "w03"), "/courses/lab-course/w03.html");
  const html = renderLesson({
    course: courseWithLab,
    lesson: lessonWith("# x"),
    prev: { id: "w01", title: "One" },
    next: null,
  });
  assert.ok(html.includes('href="/courses/lab-course/w01.html"'));
  assert.ok(html.includes('class="pager"'));
});

test("readLessons reads manifest order and loads lab code from disk", async () => {
  const course = {
    ...courseWithLab,
    dir: new URL("../__fixtures__/lessons-course", import.meta.url).pathname,
    lessons: { root: "lessons", order: ["b", "a"], items: [] },
  };
  const lessons = await readLessons(course);
  assert.deepEqual(lessons.map((l) => l.id), ["b", "a"]);
  assert.equal(lessons[0].title, "Second");
  assert.ok(lessons[0].labCode.includes("def second"));
  assert.equal(lessons[1].labCode, null);
});

test("readLessons rejects a manifest order that names a missing file", async () => {
  const course = {
    ...courseWithLab,
    dir: new URL("../__fixtures__/lessons-course", import.meta.url).pathname,
    lessons: { root: "lessons", order: ["nope"], items: [] },
  };
  await assert.rejects(() => readLessons(course), /lessons\/nope\.md/);
});
