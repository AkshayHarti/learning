import test from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, attr } from "./html.mjs";

test("escapeHtml neutralises markup and quotes", () => {
  assert.equal(escapeHtml("<script>alert('x')</script>"), "&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;");
  assert.equal(escapeHtml('a & b "c"'), "a &amp; b &quot;c&quot;");
});

test("escapeHtml leaves plain text alone", () => {
  assert.equal(escapeHtml("Attention is all you need"), "Attention is all you need");
});

test("attr is escapeHtml for attribute values", () => {
  assert.equal(attr('x" onload="alert(1)'), "x&quot; onload=&quot;alert(1)");
});
