import test from "node:test";
import assert from "node:assert/strict";
import { renderHome } from "./render-home.mjs";
import { demoCourse, secondCourse } from "../__fixtures__/courses.mjs";

const demo = demoCourse;
const second = secondCourse;

test("home lists each live course once, in order, with its promise", () => {
  const html = renderHome([demo, second]);
  assert.equal(html.match(/href="\/courses\/demo-course\/"/g).length, 1);
  assert.ok(html.indexOf("demo-course") < html.indexOf("second-course"));
  assert.ok(html.includes("Twelve interactive steps"));
  assert.ok(!html.includes("Draft course"));
  assert.match(html, /<h1>[^<]+<\/h1>/);
});

test("escapes manifest text", () => {
  const html = renderHome([{ ...demo, title: "A & B <script>" }]);
  assert.ok(html.includes("A &amp; B &lt;script&gt;"));
  assert.ok(!html.includes("<script>"));
});

test("home is a full document with the shared chrome", () => {
  const html = renderHome([demo, second]);
  assert.ok(html.startsWith("<!doctype html>"));
  assert.ok(html.includes('lang="en"'));
  assert.ok(html.includes('class="skip-link"'));
  assert.ok(html.includes("<header"));
  assert.ok(html.includes("<footer"));
  assert.ok(html.includes("Demo course"));
  assert.ok(html.includes("Second course"));
  assert.ok(html.includes("<title>Learning</title>"));
});

test("an empty registry renders an explanation rather than a blank page", () => {
  const html = renderHome([]);
  assert.match(html, /<h1>[^<]+<\/h1>/);
  assert.ok(html.includes("No courses yet"));
});
