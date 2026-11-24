import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const root = new URL("../../", import.meta.url).pathname;
const courseDir = join(root, "courses/decision-models");

async function files(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await files(full, out);
    else if (entry.isFile()) out.push(relative(root, full).split("\\").join("/"));
  }
  return out;
}

test("decision app keeps its sibling links and has no hub link", async () => {
  const list = await files(join(courseDir, "app"));
  for (const file of list) {
    if (!/\.(html|js)$/.test(file)) continue;
    const source = await readFile(join(root, file), "utf8");
    assert.ok(!/href="index\.html"/.test(source), `${file} still links the old hub`);
  }

  const assessJs = await readFile(join(courseDir, "app/assets/dec-assess.js"), "utf8");
  assert.ok(assessJs.includes('href="decision-course.html#interface"'), "assessment must point back at the course");

  const courseJs = await readFile(join(courseDir, "app/assets/dec-course.js"), "utf8");
  assert.ok(courseJs.includes('href="assessment.html"'), "decision course must link its assessment");
});

test("the bespoke assessment page loads its own modules", async () => {
  const html = await readFile(join(courseDir, "app/assessment.html"), "utf8");
  assert.ok(html.includes("assets/dec-assess.js"));
  assert.ok(html.includes("assets/dec-engine.js"));
});

test("manifest entry, assessment target and contents all exist", async () => {
  const course = JSON.parse(await readFile(join(courseDir, "course.json"), "utf8"));
  assert.ok((await stat(join(courseDir, "app", course.app.entry))).isFile());
  for (const assessment of course.assessments) {
    assert.ok((await stat(join(courseDir, "app", assessment.href))).isFile(), assessment.href);
  }
  for (const item of course.contents) {
    assert.ok((await stat(join(courseDir, item.href))).isFile(), item.href);
  }
});
