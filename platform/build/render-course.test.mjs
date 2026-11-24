import test from "node:test";
import assert from "node:assert/strict";
import { renderCourse, courseHref } from "./render-course.mjs";
import { demoCourse, secondCourse } from "../__fixtures__/courses.mjs";

test("courseHref is namespaced by slug", () => {
  assert.equal(courseHref(demoCourse), "/courses/demo-course/");
  assert.equal(courseHref({ slug: "x-y" }), "/courses/x-y/");
});

test("app course landing offers a primary entry link and its contents", () => {
  const html = renderCourse(demoCourse);
  assert.ok(html.includes('href="/courses/demo-course/app/index.html"'));
  assert.ok(html.includes("Twelve interactive steps from next-token prediction to alignment."));
  assert.ok(html.includes('href="/courses/demo-course/app/01-entropy.html"'));
  assert.ok(html.includes("bits and surprise"));
  assert.ok(html.includes("<h1>Demo course</h1>"));
});

test("meta row reports kind, hours and counts", () => {
  const html = renderCourse(demoCourse);
  assert.match(html, /<dd>interactive<\/dd>/);
  assert.match(html, /<dd>8h<\/dd>/);
  assert.match(html, /<dd>1 lab<\/dd>/);
  const lessons = renderCourse(secondCourse);
  assert.match(lessons, /<dd>lessons<\/dd>/);
  assert.match(lessons, /<dd>2 lessons<\/dd>/);
});

test("assessments link to the engine page or the shipped html", () => {
  const html = renderCourse(demoCourse);
  assert.ok(html.includes('href="/courses/demo-course/a/check.html"'));
  assert.ok(html.includes('href="/courses/demo-course/app/assessment.html"'));
  assert.ok(html.includes("Check yourself"));
  assert.ok(html.includes("Priced scenario"));
});

test("a lessons course links its first lesson instead of an app entry", () => {
  const html = renderCourse(secondCourse);
  assert.ok(html.includes('href="/courses/second-course/01-intro.html"'));
  assert.ok(!html.includes("/app/"));
});

test("landing escapes course text", () => {
  const html = renderCourse({ ...demoCourse, title: "<b>Bold</b>", promise: "a & b" });
  assert.ok(html.includes("&lt;b&gt;Bold&lt;/b&gt;"));
  assert.ok(!html.includes("<b>Bold</b>"));
  assert.ok(html.includes("a &amp; b"));
});
