import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { parseFrontmatter } from "../../platform/build/frontmatter.mjs";

const root = new URL("../../", import.meta.url).pathname;
const courseDir = join(root, "courses/python-decoder");

async function files(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await files(full, out);
    else if (entry.isFile()) out.push(relative(courseDir, full).split("\\").join("/"));
  }
  return out;
}

const course = JSON.parse(await readFile(join(courseDir, "course.json"), "utf8"));

test("every lesson in the manifest exists and declares its lab", async () => {
  for (const id of course.lessons.order) {
    const { data } = parseFrontmatter(await readFile(join(courseDir, "lessons", `${id}.md`), "utf8"));
    assert.ok(data.title, `${id} has no title`);
    if (/^w0\d$/.test(id)) {
      assert.ok(existsSync(join(courseDir, data.lab)), `${id} lab ${data.lab}`);
      assert.ok(existsSync(join(courseDir, data.solution)), `${id} solution ${data.solution}`);
      assert.match(data.run, /uv run pytest weeks\/w0\d/, `${id} run command`);
      assert.ok(Number(data.minutes) >= 60, `${id} minutes`);
    }
  }
});

test("the lesson order is the eight weeks between syllabus and capstone", () => {
  assert.deepEqual(course.lessons.order, [
    "syllabus",
    "w01",
    "w02",
    "w03",
    "w04",
    "w05",
    "w06",
    "w07",
    "w08",
    "instructor",
    "capstone",
  ]);
});

test("the runnable lab environment came across whole", async () => {
  for (const file of [
    "pyproject.toml",
    "Makefile",
    "weeks/__init__.py",
    "weeks/_loader.py",
    "weeks/_model.py",
    "mygpt/model.py",
    "mygpt/tensor.py",
    "tests/test_model.py",
    "weeks/w04_transformer/test_lab.py",
  ]) {
    assert.ok(existsSync(join(courseDir, file)), file);
  }
});

test("no interpreted artefacts or caches were copied", async () => {
  for (const file of await files(courseDir)) {
    assert.ok(!file.includes("__pycache__"), `${file} is a cache`);
    assert.ok(!file.endsWith(".pyc"), `${file} is bytecode`);
  }
});

test("labs ship the exercise, solutions ship a different answer", async () => {
  const { data } = parseFrontmatter(await readFile(join(courseDir, "lessons/w01.md"), "utf8"));
  const lab = await readFile(join(courseDir, data.lab), "utf8");
  const solution = await readFile(join(courseDir, data.solution), "utf8");
  assert.notEqual(lab, solution);
  assert.match(lab, /TODO|raise NotImplementedError/);
});

test("the landing points at the explorables where they now live", () => {
  const link = course.contents.find((item) => item.href.startsWith("/courses/"));
  assert.ok(link, "no cross-course contents link");
  assert.equal(link.href, "/courses/decoder-course/app/course.html");
});
