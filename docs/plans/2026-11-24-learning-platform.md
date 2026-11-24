# Learning Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the three learning artifacts into one public, manifest-driven course platform at `repos/learning`, deployed once to Cloudflare so every course opens from anywhere.

**Architecture:** A plain-Node static builder reads `courses/*/course.json`, generates the home page, one landing per course, markdown lesson pages and JSON assessments, then mounts each existing interactive app verbatim under `/courses/<slug>/app/`. All routes are pre-rendered; the shell ships one CSS file and one small ES module. Deploy is an assets-only Cloudflare Worker.

**Tech Stack:** Node ≥ 22 (`node --test`, no test framework), `marked` for markdown, `zod` for the manifest schema, `wrangler` (dev dependency) for deploy. The only other bundler is `courses/system-design`'s own Vite build.

**Spec:** `docs/superpowers/specs/2026-11-24-learning-platform-design.md`

## Global Constraints

- Static only. No browser Python, no server, no database, no accounts.
- Public repo and public site; the Python course ships **with** `solutions/` and `INSTRUCTOR.md`.
- Runtime browser code: no third-party JS, no webfonts, no analytics, no cookies.
- Node `>=22`; build dependencies limited to `marked` and `zod`; `wrangler` dev-only.
- Every course URL is namespaced `/courses/<slug>/`; landing owns the directory root; apps mount under `app/`.
- Build is deterministic: two consecutive builds produce byte-identical trees.
- Slug pattern `^[a-z0-9][a-z0-9-]{1,40}$`, must equal its directory name, and must not be a reserved word: `assets`, `courses`, `a`, `search-index.json`, `sitemap.xml`, `robots.txt`, `404.html`.
- Course `promise` ≤ 160 characters; body copy is sentence case, no exclamation marks.
- Existing course files are mounted byte-identical except the seven hub links listed in Task 8/9 and the injected pill.
- Accessibility floor: one `<h1>`, landmarks, skip link, visible focus, 4.5:1 body contrast, `<fieldset>/<legend>` for assessment options.

## Review Focus

1. **Relative links after nesting** — every lab, asset and assessment must still resolve from `/courses/<slug>/app/…`; a wrong depth turns a working lab into a 404. Pinned by Task 5's linkcheck test and Tasks 8–9's "no hub links remain" test.
2. **Stale assessment state** — a saved answer for an item that no longer exists must not crash or inflate the score. Pinned by Task 4's `resumeState` test.
3. **Content that looks like code** — HTML/JS inside markdown must render as escaped text, never execute. Pinned by Task 3's escaping test.
4. **Draft or incomplete course** — a course missing its entry or lesson must fail the build naming the file, not ship half a course. Pinned by Tasks 1 and 6.
5. **Reserved slugs** — a course named `assets` or `a` must be rejected, not shadow the shell. Pinned by Task 1's reserved-slug test.

---

### Task 1: Repo scaffold, manifest schema, course discovery

**Files:**
- Create: `package.json`, `.gitignore`, `README.md` (stub), `AGENTS.md`
- Create: `platform/build/schema.mjs`, `platform/build/discover.mjs`, `platform/build/html.mjs`
- Test: `platform/build/discover.test.mjs`
- Create fixture: `platform/__fixtures__/demo-course/course.json`, `platform/__fixtures__/demo-course/app/index.html`

**Interfaces:**
- Produces:
  - `courseSchema` — zod schema, exported for reuse.
  - `parseCourse(raw, { dir }) → Course` — throws `CourseManifestError` (has `.message`, `.file`).
  - `discoverCourses({ rootDir }) → Promise<{ courses: Course[], errors: string[] }>` — live courses sorted by `order`; drafts parsed but omitted from `courses`.
  - `Course` (the shape every later task consumes):
    ```js
    { slug, title, promise, kind, status, order, hours, tags,
      app: { entry, build, mountDir } | null,     // build: "vite" | null; mountDir = "app"
      lessons: { root, order, items } | null,    // items[] filled by Task 3
      assessments: [{ id, title, engine, file, href }],
      contents: [{ title, href, note }],
      progressKey, dir }
    ```
  - `escapeHtml(string) → string`, `attr(string) → string` in `platform/build/html.mjs`.

- [ ] **Step 1: Scaffold the repo**

```bash
cd ~/workspace/repos && mkdir learning && cd learning && git init -b main
npm init -y
npm pkg set name=learning version=0.1.0 private=false type=module engines.node=">=22"
npm pkg set scripts.test="node --test" scripts.validate="node platform/build/cli.mjs validate" \
  scripts.build="node platform/build/cli.mjs build" scripts.dev="node platform/site/dev.mjs" \
  scripts.new="node scripts/new-course.mjs" scripts.deploy="npm run build && npx wrangler deploy"
npm pkg set dependencies.marked="^14.1.2" dependencies.zod="^3.23.8"
npm pkg set devDependencies.wrangler="^3.90.0"
npm install
printf 'node_modules/\ndist/\n.DS_Store\n' > .gitignore
```

- [ ] **Step 2: Write the failing discovery test**

`platform/build/discover.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { discoverCourses } from "./discover.mjs";

const root = new URL("../__fixtures__/registry", import.meta.url).pathname;

test("parses a valid course and fills defaults", async () => {
  const { courses, errors } = await discoverCourses({ rootDir: root });
  assert.deepEqual(errors, []);
  const demo = courses.find((c) => c.slug === "demo-course");
  assert.equal(demo.kind, "app");
  assert.equal(demo.app.entry, "index.html");
  assert.equal(demo.app.mountDir, "app");
  assert.equal(demo.progressKey, "learning:demo-course:v1");
});

test("sorts live courses by order and drops drafts", async () => {
  const { courses } = await discoverCourses({ rootDir: root });
  assert.deepEqual(courses.map((c) => c.slug), ["demo-course", "second-course"]);
});

test("rejects duplicate slug, slug/dir mismatch, missing entry and reserved slug", async () => {
  const { errors } = await discoverCourses({ rootDir: new URL("../__fixtures__/broken", import.meta.url).pathname });
  assert.ok(errors.some((e) => e.includes("duplicate slug demo-course")));
  assert.ok(errors.some((e) => e.includes("does not match directory")));
  assert.ok(errors.some((e) => e.includes("missing app entry index.html")));
  assert.ok(errors.some((e) => e.includes("reserved slug assets")));
});
```

Fixtures: `__fixtures__/registry/demo-course/` (app/index.html, order 10), `registry/second-course/` (kind `lessons`, order 20, `lessons/` with one file), `registry/draft-course/` (status `draft`), plus the four broken dirs referenced above.

- [ ] **Step 3: Run the test and watch it fail**

Run: `npm test -- platform/build/discover.test.mjs`
Expected: FAIL — `Cannot find module './discover.mjs'`.

- [ ] **Step 4: Implement the schema and discovery**

`schema.mjs`: zod object with the fields in the spec §4; `kind` enum `app|lessons|hybrid`; `status` enum `live|draft`; refinements for `kind`↔content. `discover.mjs`: read `courses/*/course.json`, run `parseCourse`, check slug==dirname, reserved list, duplicate slug and order; resolve `app.entry` against `<dir>/app/`; return `{ courses, errors }` with one-line messages that name the file.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- platform/build/discover.test.mjs`
Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: course manifest schema and registry discovery"
```

---

### Task 2: Layout, home page, course landing pages

**Files:**
- Create: `platform/site/layout.mjs`, `platform/site/shell.css`, `platform/site/shell.js`
- Create: `platform/build/render-home.mjs`, `platform/build/render-course.mjs`
- Test: `platform/build/render-home.test.mjs`, `platform/build/render-course.test.mjs`

**Interfaces:**
- Consumes: `Course`, `escapeHtml`, `attr`.
- Produces:
  - `page({ title, description, body, active }) → string` — full HTML document with skip link, header nav (`Courses`, `All`), `<main>`, footer.
  - `pillHtml() → string` — the floating `All courses` anchor with marker `<!--learning-pill-->`.
  - `renderHome(courses) → string`, `renderCourse(course) → string`.
  - `courseHref(course) → "/courses/<slug>/"` in `render-course.mjs`.

- [ ] **Step 1: Write the failing render tests**

```js
// render-home.test.mjs
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
```

`render-course.test.mjs`: landing shows promise, meta row (`kind`, `hours`, step/lesson count), `contents` links rewritten to `/courses/<slug>/<href>`, assessment links, and for app kinds a primary CTA to `/courses/<slug>/app/<entry>`.

- [ ] **Step 2: Run and watch them fail**

Run: `npm test -- platform/build/render-home.test.mjs platform/build/render-course.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement layout, home and course landing**

`layout.mjs` emits the document shell with metadata per spec §6 (title `… · Learning`, description from promise/summary, inline SVG favicon). `shell.css`: the token block from the spec (near-black `#0a0a0b`, ink `#ecebe7`, accent `#e2b055`), card grid, lesson typography (72ch), 200 lines max, no framework. `shell.js`: mobile `details` toggle + `aria-current` handling only.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- platform/build/render-home.test.mjs platform/build/render-course.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: shared layout, home page and per-course landing"
```

---

### Task 3: Markdown lessons (frontmatter, TOC, code panels)

**Files:**
- Create: `platform/build/frontmatter.mjs`, `platform/build/markdown.mjs`, `platform/build/render-lessons.mjs`
- Test: `platform/build/render-lessons.test.mjs`

**Interfaces:**
- Produces:
  - `parseFrontmatter(text) → { data, body }` — scalars and quoted strings only.
  - `renderMarkdown(md) → string` (marked, `headerIds` off; caller adds ids).
  - `renderLesson({ course, lesson, prev, next }) → string`; `lesson` = `{ id, title, summary, minutes, lab, solution, run, body }`.
  - `readLessons(course) → Promise<Lesson[]>` — reads `lessons/<id>.md` in manifest order, resolves `lab`/`solution` relative to the course dir.
  - `lessonHref(course, id) → "/courses/<slug>/<id>.html"`.

- [ ] **Step 1: Write the failing tests**

```js
test("frontmatter scalars are parsed and stripped from the body", () => {
  const { data, body } = parseFrontmatter("---\ntitle: Week 1\nminutes: 300\nrun: \"uv run pytest\"\n---\n# H\n");
  assert.deepEqual(data, { title: "Week 1", minutes: "300", run: "uv run pytest" });
  assert.ok(body.startsWith("# H"));
});

test("lesson renders TOC entries for h2 and h3 with stable ids", () => {
  const html = renderLesson({ course, lesson: lessonWith("## Derive\n### One\n## Build\n"), prev: null, next: null });
  assert.ok(html.includes('href="#derive"'));
  assert.ok(html.includes('id="build"'));
  assert.ok(html.includes("<nav class=\"toc\""));
});

test("code inside markdown is escaped, never executed", () => {
  const html = renderLesson({ course, lesson: lessonWith("```html\n<script>alert(1)</script>\n```\n"), prev: null, next: null });
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(!html.includes("<script>alert(1)</script>"));
});

test("lab and solution panels render with the run command", () => {
  const html = renderLesson({ course: courseWithLab, lesson, prev, next });
  assert.ok(html.includes('class="code-panel"') && html.includes("data-copy"));
  assert.ok(html.includes("uv run pytest weeks/w01_prediction"));
  assert.ok(html.includes('href="/courses/demo-course/w02.html"')); // next link
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `npm test -- platform/build/render-lessons.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Slugify headings, add ids, build the right-margin TOC from h2/h3, render `lab`/`solution` as escaped `<pre><code>` panels with a copy button (`data-copy`), and a local-run callout when `run` is present. `shell.js` gains the copy handler.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- platform/build/render-lessons.test.mjs`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: markdown lessons with frontmatter, TOC and code panels"
```

---

### Task 4: Assessment engine (JSON item bank)

**Files:**
- Create: `platform/site/assessment-core.mjs`, `platform/site/assessment.js`, `platform/build/render-assessments.mjs`
- Test: `platform/build/assessment-core.test.mjs`

**Interfaces:**
- Produces:
  - `validateBank(bank) → string[]` (empty = valid): requires `id`, `title`, non-empty `items`, each with `id`, `prompt`, ≥2 `options`, `answer` matching an option, `explanation`; `passRatio` default `0.7`.
  - `scoreAnswers(answers, bank) → { total, correct, ratio, pass, misses }`, `misses = [{ itemId, chosen, answer }]`.
  - `resumeState(saved, bank) → { index, answers }` — drops ids not in the bank, clamps `index`.
  - `renderAssessment({ course, assessment, bank }) → string` — page with the bank embedded as `<script type="application/json" id="bank">`.
  - Browser module `assessment.js`: `init(root, bank, storageKey)`; commit-then-reveal per item; `aria-live="polite"` result; persists after every commit.

- [ ] **Step 1: Write the failing tests**

```js
test("scores a bank and lists misses with the right answer", () => {
  const result = scoreAnswers({ q1: "a", q2: "b" }, bankOfTwo);
  assert.deepEqual(result, { total: 2, correct: 1, ratio: 0.5, pass: false,
    misses: [{ itemId: "q1", chosen: "a", answer: "b" }] });
});

test("passes exactly at passRatio", () => {
  assert.equal(scoreAnswers({ q1: "b", q2: "b" }, { ...bankOfTwo, passRatio: 1 }).pass, true);
});

test("resume ignores answers for items that no longer exist", () => {
  const state = resumeState({ index: 9, answers: { gone: "a", q1: "b" } }, bankOfTwo);
  assert.deepEqual(state, { index: 1, answers: { q1: "b" } });
});

test("validation names each broken field", () => {
  const errors = validateBank({ id: "x", items: [{ id: "q1", prompt: "p", options: [{ id: "a", text: "A" }], answer: "b" }] });
  assert.ok(errors.some((e) => e.includes("q1.answer")));
  assert.ok(errors.some((e) => e.includes("q1.options")));
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `npm test -- platform/build/assessment-core.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement core, renderer, browser module**

Keep `assessment-core.mjs` pure (no DOM) so it is testable in Node; `assessment.js` imports it with `import { scoreAnswers, resumeState } from "./assessment-core.mjs"`. Renderer embeds the bank JSON with `<` escaped as `\u003c`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- platform/build/assessment-core.test.mjs`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: item-bank assessment engine with resumable state"
```

---

### Task 5: Mount apps, inject pill, redirect entry

**Files:**
- Create: `platform/build/mount-app.mjs`
- Test: `platform/build/mount-app.test.mjs`

**Interfaces:**
- Consumes: `Course`, `pillHtml()`.
- Produces:
  - `mountApp({ course, distDir }) → Promise<{ files: number }>` — copies `course.dir/app/` to `distDir/courses/<slug>/app/` byte-identical, then inserts the pill before the last `</body>` of every `.html` (idempotent, keyed on `<!--learning-pill-->`).
  - Emits `app/index.html` as a redirect when `course.app.entry !== "index.html"`.

- [ ] **Step 1: Write the failing test**

```js
test("copies files byte-identical except one injected pill per html file", async () => {
  const { distDir, files } = await mountFixture();
  assert.equal(await sha256(join(distDir, "courses/demo-course/app/assets/app.js")),
               await sha256(join(fixtureDir, "app/assets/app.js")));
  const html = await readFile(join(distDir, "courses/demo-course/app/course.html"), "utf8");
  assert.equal(html.match(/learning-pill/g).length, 1);
  assert.ok(html.indexOf("learning-pill") > html.lastIndexOf("<article"));
});

test("writes a redirect when entry is not index.html", async () => {
  const html = await readFile(join(distDir, "courses/demo-course/app/index.html"), "utf8");
  assert.ok(html.includes('http-equiv="refresh"') && html.includes("course.html"));
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npm test -- platform/build/mount-app.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement**

Recursive copy with `fs.cp`; only `.html` is transformed, everything else is copied untouched. Redirect page is `<meta http-equiv="refresh" content="0;url=course.html">` plus a plain `<a>` fallback.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- platform/build/mount-app.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: mount interactive apps with course pill and entry redirect"
```

---

### Task 6: Link-check, site metadata, build orchestrator

**Files:**
- Create: `platform/build/linkcheck.mjs`, `platform/build/emit.mjs`, `platform/build/build.mjs`
- Test: `platform/build/linkcheck.test.mjs`, `platform/build/build.test.mjs`

**Interfaces:**
- Produces:
  - `checkLinks({ distDir }) → Promise<{ ok, broken: [{ page, href }] }>` — resolves every `href`/`src`/`url()` relative to its page; ignores `#…`, `mailto:`, `https:`, `data:`, `tel:`.
  - `emitMeta({ courses, distDir, rootDir }) → Promise<void>` — `sitemap.xml`, `robots.txt`, `404.html`, `search-index.json` (`[{ route, title, headings[] }]`), `build.json` (`{ builtFrom, courses: [{ slug, route, entry, lessons }] }`).
  - `build({ rootDir, distDir }) → Promise<{ courses, files }>` — full pipeline; throws on manifest errors or broken links.

- [ ] **Step 1: Write the failing tests**

```js
test("linkcheck reports a missing asset and ignores hash and mailto", async () => {
  const { broken } = await checkLinks({ distDir: brokenFixture });
  assert.deepEqual(broken, [{ page: "index.html", href: "assets/missing.css" }]);
});

test("build produces home, landing, lesson, assessment, app and metadata", async () => {
  await build({ rootDir: fixtureRegistry, distDir });
  for (const f of ["index.html", "courses/demo-course/index.html", "courses/demo-course/app/course.html",
                   "sitemap.xml", "robots.txt", "404.html", "search-index.json", "build.json"]) {
    assert.ok(existsSync(join(distDir, f)), f);
  }
  const sitemap = await readFile(join(distDir, "sitemap.xml"), "utf8");
  assert.ok(sitemap.includes("/courses/demo-course/"));
});

test("build fails loudly on a broken internal link", async () => {
  await assert.rejects(() => build({ rootDir: brokenLinkRegistry, distDir }), /broken link/i);
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `npm test -- platform/build/linkcheck.test.mjs platform/build/build.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement**

`build.mjs` order: discover → render home → per course (landing, lessons, assessments, mount) → system-design build hook (Task 11) → `emitMeta` → `checkLinks` (throw listing every offender) → write `build.json`. Reserved-path slugs already rejected in Task 1.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, all suites.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: build orchestrator with link checking and site metadata"
```

---

### Task 7: CLI, dev server, smoke test, determinism

**Files:**
- Create: `platform/build/cli.mjs`, `platform/site/dev.mjs`, `scripts/smoke.mjs`
- Test: `platform/build/determinism.test.mjs`

**Interfaces:**
- Produces:
  - `cli.mjs build|validate` — `validate` runs discovery + link-check against a fresh build in a temp dir; non-zero exit and readable errors on failure.
  - `dev.mjs` — rebuild on change (fs.watch on `courses/` + `platform/`) and serve `dist` on `http://localhost:4321` with correct MIME types.
  - `scripts/smoke.mjs` — reads `dist/build.json`, GETs every route plus every lesson/assessment, asserts 200 and that `<title>` is non-empty.

- [ ] **Step 1: Write the failing determinism test**

```js
test("two builds produce identical file trees", async () => {
  await build({ rootDir: fixtureRegistry, distDir: a });
  await build({ rootDir: fixtureRegistry, distDir: b });
  assert.deepEqual(await treeHashes(a), await treeHashes(b));
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npm test -- platform/build/determinism.test.mjs`
Expected: FAIL (no `build` export yet in this path, or timestamps differ).

- [ ] **Step 3: Implement CLI, dev server, smoke script**

Exclude `build.json`'s build timestamp from the tree if it exists; prefer no timestamp at all. `npm run validate` must fail on a deliberately broken fixture (assert in the test).

- [ ] **Step 4: Run all checks**

Run: `npm test && npm run build && node scripts/smoke.mjs`
Expected: tests PASS; build writes `dist`; smoke prints `ok <n> routes`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: cli, dev server, smoke test and determinism guard"
```

---

### Task 8: Migrate the decoder course

**Files:**
- Create: `courses/decoder-course/course.json`
- Create: `courses/decoder-course/app/**` (copy of `~/workspace/repos/llm-first-principles/explorables/`)
- Modify: `app/assets/course.js:195`, foot link in `app/01-entropy.html` … `app/05-sampling.html`
- Test: `courses/decoder-course/course.test.mjs`

**Interfaces:**
- Consumes: `Course` schema, `build`.
- Produces: a live `app` course with `contents` listing the five labs.

- [ ] **Step 1: Copy the explorables directory**

```bash
mkdir -p courses/decoder-course/app
cp -R ~/workspace/repos/llm-first-principles/explorables/. courses/decoder-course/app/
rm courses/decoder-course/app/index.html        # the old explorables hub, replaced by the landing
```

- [ ] **Step 2: Declare the course**

`course.json`: slug `decoder-course`, title `The decoder course`, promise "Twelve interactive steps from next-token prediction to alignment.", kind `app`, order 10, hours 8, tags `["llm","transformers"]`, app entry `course.html`, and `contents` = the five labs (`app/01-entropy.html` … `app/05-sampling.html`) with their one-line descriptions from the old hub.

- [ ] **Step 3: Write the failing test**

```js
test("decoder app has no link to the removed explorables hub", async () => {
  const files = await glob("courses/decoder-course/app/**/*.{html,js}");
  for (const f of files) assert.ok(!(await readFile(f, "utf8")).includes('href="index.html"'), f);
});

test("every contents entry exists and the entry file is present", async () => {
  const c = JSON.parse(await readFile("courses/decoder-course/course.json", "utf8"));
  assert.ok(existsSync(`courses/decoder-course/app/${c.app.entry}`));
  for (const item of c.contents) assert.ok(existsSync(join("courses/decoder-course", item.href)), item.href);
});
```

- [ ] **Step 4: Run and watch it fail**

Run: `npm test -- courses/decoder-course/course.test.mjs`
Expected: FAIL — 6 files still link `index.html`.

- [ ] **Step 5: Apply the seven hub-link rewrites**

- `app/assets/course.js:195` — `link: ['index.html', 'all five deep-dive explorables']` → `link: ['../', 'all five deep-dive explorables']`
- `app/01-entropy.html` … `app/05-sampling.html` — `href="index.html"` → `href="../"`

Note: `link` is rendered relative to `app/course.html`, so `../` resolves to the course landing.

- [ ] **Step 6: Build and verify**

Run: `npm test -- courses/decoder-course/course.test.mjs && npm run build && node scripts/smoke.mjs`
Expected: tests PASS; `/courses/decoder-course/` and `/courses/decoder-course/app/course.html` in `build.json`; linkcheck clean.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: add decoder course track"
```

---

### Task 9: Migrate the decision course and its bespoke assessment

**Files:**
- Create: `courses/decision-models/course.json`
- Create: `courses/decision-models/app/**` (from `explorables/decision-course.html`, `assessment.html`, `assets/dec*`, `assets/style.css`)
- Modify: `app/assets/dec-assess.js:361`
- Test: `courses/decision-models/course.test.mjs`

- [ ] **Step 1: Copy and declare**

Copy `decision-course.html`, `assessment.html`, `assets/{style.css,dec.css,dec-assess.css,dec-engine.js,dec-labs.js,dec-labs-2.js,dec-course.js,dec-assess.js}` into `courses/decision-models/app/`. `course.json`: slug `decision-models`, kind `app`, order 20, `app.entry: "decision-course.html"`, `assessments: [{ id: "decision-check", title: "Assess yourself", engine: "custom", href: "assessment.html" }]`.

- [ ] **Step 2: Write the failing test**

```js
test("decision course keeps sibling links and has no hub link", async () => {
  const assessment = await readFile("courses/decision-models/app/assessment.html", "utf8");
  assert.ok(assessment.includes("assets/dec-assess.js"));
  const js = await readFile("courses/decision-models/app/assets/dec-assess.js", "utf8");
  assert.ok(!js.includes('href="index.html"'));
  assert.ok(js.includes('href="decision-course.html#interface"'));
});
```

- [ ] **Step 3: Run and watch it fail**

Run: `npm test -- courses/decision-models/course.test.mjs`
Expected: FAIL — `dec-assess.js` still has `href="index.html"`.

- [ ] **Step 4: Rewrite the one hub link**

`app/assets/dec-assess.js:361` — `'<a href="index.html" class="next">…'` → `'<a href="../" class="next">…'`.

- [ ] **Step 5: Build and verify**

Run: `npm test -- courses/decision-models/course.test.mjs && npm run build && node scripts/smoke.mjs`
Expected: PASS; `/courses/decision-models/app/decision-course.html` and `/courses/decision-models/app/assessment.html` resolve; linkcheck clean.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add decision models track with bespoke assessment"
```

---

### Task 10: Migrate the Python course as lessons

**Files:**
- Create: `courses/python-decoder/course.json`
- Create: `courses/python-decoder/lessons/{syllabus,instructor,capstone,w01…w08}.md`
- Copy: `weeks/`, `mygpt/`, `tests/`, `pyproject.toml`, `Makefile`
- Test: `courses/python-decoder/course.test.mjs`

- [ ] **Step 1: Copy sources and declare the course**

Copy `weeks/`, `mygpt/`, `tests/`, `pyproject.toml`, `Makefile`, `SYLLABUS.md`, `INSTRUCTOR.md`, `CAPSTONE.md` from `~/workspace/repos/llm-first-principles/` into `courses/python-decoder/`. `course.json`: slug `python-decoder`, kind `lessons`, order 30, hours 44, `lessons: { root: "lessons", order: ["syllabus","w01"…"w08","instructor","capstone"] }`.

- [ ] **Step 2: Write the failing test**

```js
test("every lesson in the manifest exists and declares its lab", async () => {
  const c = JSON.parse(await readFile("courses/python-decoder/course.json", "utf8"));
  for (const id of c.lessons.order) {
    const { data } = parseFrontmatter(await readFile(`courses/python-decoder/lessons/${id}.md`, "utf8"));
    assert.ok(data.title, id);
    if (/^w0\d$/.test(id)) {
      assert.ok(existsSync(`courses/python-decoder/${data.lab}`), `${id} lab`);
      assert.ok(existsSync(`courses/python-decoder/${data.solution}`), `${id} solution`);
    }
  }
});
```

- [ ] **Step 3: Run and watch it fail**

Run: `npm test -- courses/python-decoder/course.test.mjs`
Expected: FAIL — missing `lessons/`.

- [ ] **Step 4: Generate the lesson files**

Write `scripts/import-python-course.mjs` (kept in the repo, idempotent, documented in `SOURCES.md`). For each of `SYLLABUS.md`, `INSTRUCTOR.md`, `CAPSTONE.md`, `weeks/w0N_*/README.md` it writes `lessons/<id>.md`, prepending frontmatter with `title`, `minutes` (from the README's **Time:** line), `lab: weeks/w0N_*/lab.py`, `solution: …/solutions/lab.py`, `run: "uv run pytest weeks/w0N_*"`. Body unchanged. Run it.

- [ ] **Step 5: Build and verify**

Run: `npm test -- courses/python-decoder/course.test.mjs && npm run build && node scripts/smoke.mjs`
Expected: PASS; `/courses/python-decoder/w01.html` contains the escaped `def entropy` lab code and the run command; linkcheck clean.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add eight-week python course as rendered lessons"
```

---

### Task 11: Mount the system-design app

**Files:**
- Create: `courses/system-design/course.json`
- Create: `courses/system-design/app/**` (repo copy minus `.git`, `node_modules`, `dist`, `.github`)
- Modify: `platform/build/build.mjs` (app build hook)
- Test: `courses/system-design/course.test.mjs`

**Interfaces:**
- Produces: `buildSystemDesign({ courseDir, outDir }) → Promise<void>` — runs `npm ci --silent && npm run build` inside `app/`, copies `app/dist` to `dist/courses/system-design/app/`, fails with the build log tail on non-zero exit.

- [ ] **Step 1: Copy and declare**

`course.json`: slug `system-design`, kind `app`, order 40, hours 13, `app: { entry: "index.html", build: "vite" }`, `tags: ["system-design","interviews"]`. No Supabase env values ship: the app stays local-first, exactly as it runs today.

- [ ] **Step 2: Write the failing test**

```js
test("system design build output lands under the course app path with relative asset URLs", async () => {
  await build({ rootDir: repoRoot, distDir });
  const html = await readFile(join(distDir, "courses/system-design/app/index.html"), "utf8");
  assert.ok(html.includes('src="./assets/'));
  assert.ok(existsSync(join(distDir, "courses/system-design/app/index.html")));
});
```

- [ ] **Step 3: Run and watch it fail**

Run: `npm test -- courses/system-design/course.test.mjs`
Expected: FAIL — no app build hook.

- [ ] **Step 4: Implement the hook**

In `build.mjs`, when a course declares `app.build: "vite"`, run the sub-build and copy `dist` into the mount. Skip the hook when `process.env.SKIP_APP_BUILD === "1"` is not set and `app/dist` already exists? No — always build; cache in CI instead.

- [ ] **Step 5: Build and verify**

Run: `npm test -- courses/system-design/course.test.mjs && npm run build && node scripts/smoke.mjs`
Expected: PASS; `/courses/system-design/app/` serves the React app; linkcheck clean.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: mount system design course via its vite build"
```

---

### Task 12: Starter template, `new` script, docs

**Files:**
- Create: `templates/course/{course.json,index.html,lessons/01-intro.md,README.md}`
- Create: `scripts/new-course.mjs`
- Create: `docs/ADDING-A-COURSE.md`, `docs/ARCHITECTURE.md`, `SOURCES.md`, `README.md`, `AGENTS.md`
- Test: `scripts/new-course.test.mjs`

**Interfaces:**
- Produces: `newCourse(slug, { rootDir }) → Promise<string>` — copies the template to `courses/<slug>/`, rewrites the slug and title, exits non-zero if the dir exists or the slug is reserved.

- [ ] **Step 1: Write the failing test**

```js
test("new course appears in discovery with no other edits", async () => {
  const dir = await tmpRepo();
  await newCourse("graphs", { rootDir: dir });
  const { courses, errors } = await discoverCourses({ rootDir: dir });
  assert.deepEqual(errors, []);
  assert.ok(courses.some((c) => c.slug === "graphs"));
  const out = await rmTmpBuild(dir);
  assert.ok(existsSync(join(out, "courses/graphs/index.html")));
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npm test -- scripts/new-course.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement the template and script**

Template is a one-lesson `lessons` course with `status: "draft"` so a new course cannot go live by accident; `new-course.mjs` flips `status` to `live` only when `--live` is passed.

- [ ] **Step 4: Write the docs**

`README.md`: what this is, `npm run dev`, `npm run build`, `npm run deploy`, and the five-line add-a-course recipe. `SOURCES.md`: `llm-first-principles` @ `2332d00` + explorables working tree 2026-11-21→23 (uncommitted), `system-design-first-principles` @ `f5648cc`, plus the date of the import. `docs/ADDING-A-COURSE.md`: manifest fields, kinds, contents, assessments, draft workflow. `docs/ARCHITECTURE.md`: pipeline diagram + URL map. `AGENTS.md`: repo rules (never hand-edit `dist/`, never rename mounted files, run `npm run validate` before commit).

- [ ] **Step 5: Run and verify**

Run: `npm test && npm run validate`
Expected: PASS, including the new-course fixture test.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: course template, new-course script and authoring docs"
```

---

### Task 13: Cloudflare deploy and live verification

**Files:**
- Create: `wrangler.jsonc`
- Modify: `README.md` (deploy section), `.github/workflows/` (deferred — do not create yet)

- [ ] **Step 1: Add the Worker config**

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "learning",
  "compatibility_date": "2026-11-24",
  "assets": { "directory": "./dist", "not_found_handling": "404-page" }
}
```

- [ ] **Step 2: Validate without publishing**

Run: `npm run build && npx wrangler deploy --dry-run`
Expected: a bundle summary (file count and `Total Upload` size) and exit 0; nothing is uploaded.

- [ ] **Step 3: Authenticate and deploy**

Run: `npx wrangler login` (approve in the browser), then `npm run deploy`.
Expected: a `https://learning.<account>.workers.dev` URL printed. Record it in `README.md` and `SOURCES.md`.

- [ ] **Step 4: Browser verification on the live URL**

With Chrome DevTools MCP, on the deployed origin:

1. `/` — four cards, correct order; no console errors.
2. `/courses/decoder-course/` landing lists five labs; `app/course.html` rail populated; next/prev advances; one lab changes a number.
3. `/courses/decision-models/app/decision-course.html` — rail works; `assessment.html` loads and a scenario reveals its arithmetic.
4. `/courses/python-decoder/w01.html` — lab panel with copy button; prev/next crosses weeks.
5. `/courses/system-design/app/` — home renders, one module opens, arena loads.
6. Pill visible on every mounted app and returns to `/`.
7. 360 px viewport on home, a landing, a lesson: no horizontal scroll.
8. Keyboard-only: home → course → lesson; one assessment item committed with Enter/Space.

- [ ] **Step 5: Record the result**

Append the checks and the date to `docs/ARCHITECTURE.md` under "Deployed". Commit:

```bash
git add -A && git commit -m "chore: cloudflare worker config and first deploy"
```

---

### Task 14: Cutover notes and final pass

**Files:**
- Modify: `SOURCES.md`, `README.md`
- Create: `docs/CUTOVER.md`

- [ ] **Step 1: Write the cutover doc**

Records: new canonical URL; that `llm-first-principles` is superseded but left intact; that `system-design-first-principles` GitHub Pages stays up until the new URL passed Task 13, then gets a banner linking to the new site; rollback command `npx wrangler rollback`.

- [ ] **Step 2: Add the superseded note**

One line at the top of `~/workspace/repos/llm-first-principles/README.md`: `> Superseded by https://github.com/AkshayHarti/learning (deployed at <url>).` Do **not** archive or delete the repo.

- [ ] **Step 3: Final verification**

Run: `npm run validate && npm test && npm run build && node scripts/smoke.mjs`
Expected: all green, `dist` ≤ 8 MB, no single asset > 2 MB.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "docs: cutover notes and superseded pointers"
```
