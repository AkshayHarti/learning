import test from "node:test";
import assert from "node:assert/strict";
import { scoreAnswers, resumeState, validateBank } from "../site/assessment-core.mjs";
import { renderAssessment, embedBank } from "./render-assessments.mjs";
import { demoCourse } from "../__fixtures__/courses.mjs";

const bankOfTwo = {
  id: "b2",
  title: "Two items",
  passRatio: 0.7,
  items: [
    { id: "q1", prompt: "p1", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], answer: "b", explanation: "e1" },
    { id: "q2", prompt: "p2", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], answer: "b", explanation: "e2" },
  ],
};

test("scores a bank and lists misses with the right answer", () => {
  const result = scoreAnswers({ q1: "a", q2: "b" }, bankOfTwo);
  assert.deepEqual(result, {
    total: 2,
    correct: 1,
    ratio: 0.5,
    pass: false,
    misses: [{ itemId: "q1", chosen: "a", answer: "b" }],
  });
});

test("passes exactly at passRatio", () => {
  assert.equal(scoreAnswers({ q1: "b", q2: "b" }, { ...bankOfTwo, passRatio: 1 }).pass, true);
});

test("unanswered items count as misses with a null choice", () => {
  const result = scoreAnswers({}, bankOfTwo);
  assert.equal(result.correct, 0);
  assert.equal(result.ratio, 0);
  assert.deepEqual(result.misses.map((m) => m.chosen), [null, null]);
});

test("resume ignores answers for items that no longer exist", () => {
  const state = resumeState({ index: 9, answers: { gone: "a", q1: "b" } }, bankOfTwo);
  assert.deepEqual(state, { index: 1, answers: { q1: "b" } });
});

test("resume tolerates junk and missing state", () => {
  assert.deepEqual(resumeState(null, bankOfTwo), { index: 0, answers: {} });
  assert.deepEqual(resumeState({ index: -4, answers: { q1: "b" } }, bankOfTwo), { index: 0, answers: { q1: "b" } });
});

test("validation names each broken field", () => {
  const errors = validateBank({
    id: "x",
    items: [{ id: "q1", prompt: "p", options: [{ id: "a", text: "A" }], answer: "b" }],
  });
  assert.ok(errors.some((e) => e.includes("q1.answer")), errors.join("\n"));
  assert.ok(errors.some((e) => e.includes("q1.options")), errors.join("\n"));
  assert.ok(errors.some((e) => e.includes("q1.explanation")), errors.join("\n"));
  assert.ok(errors.some((e) => e.includes("bank.title")), errors.join("\n"));
});

test("a well-formed bank validates clean", () => {
  assert.deepEqual(validateBank(bankOfTwo), []);
});

test("renderer embeds the bank as escaped JSON and refuses a broken bank", () => {
  const withMarkup = { ...bankOfTwo, intro: "</script><script>alert(1)</script>" };
  const html = renderAssessment({ course: demoCourse, assessment: { id: "check", title: "Check" }, bank: withMarkup });
  assert.ok(html.includes('type="application/json" id="bank"'));
  assert.ok(!html.includes("</script><script>alert(1)"));
  assert.ok(html.includes("\\u003c/script"));
  assert.ok(html.includes("/assets/assessment.js"));
  assert.throws(
    () => renderAssessment({ course: demoCourse, assessment: { id: "check", title: "Check" }, bank: { id: "x", items: [] } }),
    /bank\.items/,
  );
});

test("embedBank is deterministic and escapes every <", () => {
  assert.equal(embedBank({ a: "<b>" }), '{"a":"\\u003cb>"}');
});
