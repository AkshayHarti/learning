import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const root = new URL("../../", import.meta.url).pathname;
const courseDir = join(root, "courses/decoder-course");

async function files(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await files(full, out);
    else if (entry.isFile()) out.push(relative(root, full).split("\\").join("/"));
  }
  return out;
}

test("decoder app has no link to the removed explorables hub", async () => {
  const list = await files(join(courseDir, "app"));
  for (const file of list) {
    if (!/\.(html|js)$/.test(file)) continue;
    const source = await readFile(join(root, file), "utf8");
    assert.ok(!/href="index\.html"/.test(source), `${file} still links the old hub`);
    assert.ok(!/link:\s*\['index\.html'/.test(source), `${file} still pushes the old hub into the lesson model`);
  }
});

test("every contents entry exists and the entry file is present", async () => {
  const course = JSON.parse(await readFile(join(courseDir, "course.json"), "utf8"));
  assert.ok((await stat(join(courseDir, "app", course.app.entry))).isFile(), course.app.entry);
  for (const item of course.contents) {
    assert.ok((await stat(join(courseDir, item.href))).isFile(), item.href);
  }
});

test("the app's own assets are all present", async () => {
  for (const asset of ["style.css", "course.css", "course.js", "labs.js", "labs-more.js", "toy.js"]) {
    assert.ok((await stat(join(courseDir, "app/assets", asset))).isFile(), asset);
  }
});
