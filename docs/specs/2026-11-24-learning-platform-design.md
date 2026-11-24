# Learning platform — consolidated repo and Cloudflare deploy

**Status:** design approved in conversation (2026-11-24); awaiting spec review
**Owner:** Akshay
**Repo:** `repos/learning` (new, public)
**Deploy:** Cloudflare Workers static assets → `learning.<account>.workers.dev`

---

## 1. Intent

Three separately built learning artifacts exist across two repos:

| Source | What it is | State |
|---|---|---|
| `repos/llm-first-principles` @ `2332d00` | 8-week Python course (`weeks/w01…w08`, `mygpt/`, tests, `SYLLABUS.md`, `INSTRUCTOR.md`, `CAPSTONE.md`) + self-contained interactive explorables (`explorables/`) | private; explorables contain **uncommitted** work |
| `repos/llm-first-principles/explorables` (working tree) | "The decoder course" (12 interactive steps) and "Decision models" (10 steps) + an 18-item assessment | uncommitted |
| `repos/system-design-first-principles` @ `f5648cc` | React/Vite system-design course: 13 modules, arena, drills, optional Supabase sync | public; deployed on GitHub Pages |

They must become **one public repo** holding all learning artifacts, deployed **once** to Cloudflare so they open from anywhere.

The repo is not a one-off export. It is a **course platform**: more courses, more interactive courses, and more assessments will be added over time. Adding one must not require editing the shell, a route table, or navigation by hand.

**Success criteria**

1. One URL serves all current courses; every interactive lab still works exactly as it does locally today.
2. Adding a course = add one directory with a manifest (+ content); it appears on the home page, gets a URL, a link-checked build, and a sitemap entry with **zero** changes outside that directory.
3. `npm run build` is deterministic and fails loudly on bad manifests or broken internal links.
4. The site is public, mobile-usable, and deployable from this machine with one command after a one-time login.

**Non-goals**

- No Python execution in the browser. The 8-week course is read + copy + run locally (decided).
- No accounts, no server-side progress, no database. Progress is `localStorage`.
- No CMS/admin UI, no search UI in v1 (index is emitted, UI deferred).
- No rewriting of any existing course's UI or interaction model.

---

## 2. Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | One new public repo, fresh import (no subtree), provenance in `SOURCES.md` | Artifacts are complete snapshots; subtree adds merge friction for no user-visible gain |
| D2 | Registry model: `courses/<slug>/course.json` is the only registration mechanism | Extensibility requirement; no central list to forget to update |
| D3 | Existing interactive apps are mounted **verbatim** at their own path | Their internal relative links (`assets/*.js`, `01-entropy.html`) keep working; no regression risk |
| D4 | Shell is plain HTML/CSS/ES modules; no bundler | The only build dependency is markdown rendering + schema validation; system-design keeps its own Vite build |
| D5 | Root-level URLs are namespaced: `/courses/<slug>/` | Prevents future collisions with `/assets`, `/docs`, `/search`; slug stays the only routing input |
| D6 | Python course published in full, including `solutions/` and `INSTRUCTOR.md` | Decided: complete, forkable portfolio artifact |
| D7 | One floating "All courses" pill injected into mounted HTML; no other edits | Shared wayfinding without touching course layouts or step navigation |
| D8 | Deploy target: Workers static assets (assets-only, no Worker script) | Current Cloudflare guidance for static sites; one config file, one command, custom domain later |
| D9 | Auth: interactive `npx wrangler login` | No token to create/store now; CI token deferred |
| D10 | Bespoke simulations stay `engine: "custom"`; new assessments use the JSON item bank | Avoids rewriting the decision assessment's priced scenarios |
| D11 | Old GitHub Pages site stays up until the Cloudflare URL passes acceptance, then gets a "moved" note | No broken links during cutover |

---

## 3. Repo layout

```
learning/
├─ README.md                     # what this is; dev/build/deploy; add-a-course in 5 lines
├─ SOURCES.md                    # provenance per track: origin repo + commit SHA + date
├─ AGENTS.md                     # repo rules for future agent work
├─ package.json                  # scripts: dev, build, validate, new, deploy
├─ wrangler.jsonc
├─ courses/
│  ├─ decoder-course/
│  │  ├─ course.json
│  │  ├─ app/                    # mounted verbatim
│  │  │  ├─ course.html          # original entry name kept
│  │  │  ├─ 01-entropy.html … 05-sampling.html
│  │  │  └─ assets/              # its own copy (style.css, course.css, course.js, toy.js, labs*.js)
│  ├─ decision-models/
│  │  ├─ course.json
│  │  ├─ app/
│  │  │  ├─ decision-course.html
│  │  │  ├─ assessment.html      # bespoke simulation assessment (engine: custom)
│  │  │  └─ assets/              # its own copy (style.css, dec*.css/js)
│  │  ├─ assessments/decision-check.json
│  ├─ python-decoder/
│  │  ├─ course.json
│  │  ├─ lessons/                # syllabus.md, instructor.md, capstone.md, w01.md … w08.md
│  │  ├─ weeks/                  # labs + solutions + tests, as-is
│  │  ├─ mygpt/
│  │  └─ tests/
│  └─ system-design/
│     ├─ course.json
│     └─ app/                    # index.html  src/  package.json  vite.config.ts  supabase/
├─ platform/
│  ├─ build/
│  │  ├─ build.mjs               # orchestrator
│  │  ├─ discover.mjs            # read + validate manifests
│  │  ├─ schema.mjs              # zod schema, exported for tests
│  │  ├─ render-home.mjs
│  │  ├─ render-course.mjs       # landing page per course
│  │  ├─ render-lessons.mjs      # markdown → HTML, TOC, prev/next, code panels
│  │  ├─ render-assessments.mjs
│  │  ├─ mount-app.mjs           # copy app dirs, inject pill
│  │  ├─ linkcheck.mjs
│  │  └─ emit.mjs                # sitemap, robots, 404, search-index
│  ├─ site/
│  │  ├─ layout.mjs              # page shell, nav, <head> metadata, pill markup
│  │  ├─ shell.css  shell.js     # shared chrome + lesson behaviours
│  │  ├─ assessment.js           # item-bank UI (browser module)
│  │  ├─ assessment-core.mjs     # scoring/state, unit-tested in node
│  │  └─ dev.mjs                 # watch + static server
│  └─ __fixtures__/demo-course/  # proves "drop a dir, it appears" in tests
├─ templates/course/             # copy-me starter (manifest + index.html + lesson.md)
├─ scripts/new-course.mjs        # `npm run new -- <slug>`
├─ docs/
│  ├─ ADDING-A-COURSE.md
│  └─ ARCHITECTURE.md
└─ dist/                         # build output, gitignored
```

**Toolchain:** Node ≥ 22; runtime deps `marked` (markdown) and `zod` (manifest schema); dev dep `wrangler` (so `wrangler.jsonc`'s `$schema` resolves). Nothing else — the shell ships no third-party JS to the browser.

---

## 4. Course manifest

`courses/<slug>/course.json`, validated by `platform/build/schema.mjs`:

```jsonc
{
  "slug": "decoder-course",            // required, ^[a-z0-9][a-z0-9-]{1,40}$, unique, must equal dir name
  "title": "The decoder course",       // required
  "promise": "Twelve interactive steps from next-token prediction to alignment.", // required, <= 160 chars
  "kind": "app",                       // required: "app" | "lessons" | "hybrid"
  "status": "live",                    // "live" | "draft"; drafts are validated but not rendered
  "order": 10,                         // integer; home sorts ascending, ties fail validation
  "hours": 8,                          // optional number, shown on the card
  "tags": ["llm", "transformers"],     // optional
  "app": { "entry": "course.html" },   // required when kind is app|hybrid; file must exist under app/
  // "build": "vite" is optional inside app — runs the app's own build before mounting (system-design)
  "contents": [                        // optional; rendered on the landing page as a contents list
    { "title": "Prediction is compression", "href": "app/01-entropy.html", "note": "entropy, bits, surprisal" }
  ],
  "lessons": {                         // required when kind is lessons|hybrid
    "root": "lessons",
    "order": ["syllabus", "w01", "w02"] // explicit; unknown id fails validation
  },
  "assessments": [                     // optional
    {
      "id": "decision-check",
      "title": "Assess yourself",
      "engine": "items",               // "items" | "custom"
      "file": "assessments/decision-check.json",  // required for items
      "href": "assessment.html"        // required for custom
    }
  ],
  "progressKey": "learning:decoder-course:v1"  // optional override; default derived from slug
}
```

**Validation failures (build exits non-zero, names file + field):** duplicate slug or order, slug ≠ directory, missing entry/lesson file, lesson id not in `order`, `kind`/content mismatch, assessment missing `file` or `href`, `status` not in enum, promise over 160 chars.

**Lesson frontmatter** (markdown files in `lessons/`, all optional):

```yaml
---
title: Week 1 — Prediction is compression   # default: first H1
summary: Entropy, cross-entropy, perplexity, n-grams.
minutes: 300
lab: weeks/w01_prediction/lab.py            # rendered as a code panel with copy button
solution: weeks/w01_prediction/solutions/lab.py
run: "uv run pytest weeks/w01_prediction"   # shown in the local-run callout
---
```

---

## 5. URL map and build output

```
/                                        home: hero, course cards (live only), per-card open link
/courses/<slug>/                         generated course landing: promise, meta, contents, assessments
/courses/<slug>/app/<entry>              mounted app (app/hybrid kinds); entry name preserved
/courses/<slug>/<lesson>.html            rendered lesson (lessons/hybrid kinds)
/courses/<slug>/a/<assessment-id>.html   item-bank assessment
/assets/shell.*                          shell CSS/JS (hashed)
/search-index.json  sitemap.xml  robots.txt  404.html
```

**Collision rule:** the landing always owns `/courses/<slug>/`, so an app's own `index.html` cannot sit there. Apps mount under `app/`; if the entry is not `index.html`, the build also emits `app/index.html` as a redirect to the entry for any link that assumed it.

Build pipeline (single pass, no network):

1. **Discover + validate** all manifests; sort by `order`; drop `draft`.
2. **Render home** from the registry.
3. **Render course landings** (what it is, how long, what you produce, table of contents, assessments).
4. **Render lessons** from markdown: heading TOC, prev/next, code panels for `lab`/`solution`, `run` callout, reading progress bar.
5. **Render assessments** (`engine: items` only) from JSON.
6. **Mount apps**: copy `app/` to `dist/courses/<slug>/app/` byte-identical (plus an `index.html` redirect when the entry is not `index.html`), then insert the pill before `</body>` in every mounted HTML file.
7. **Build system-design**: `npm ci && npm run build` in `courses/system-design`, output to `dist/courses/system-design/`.
8. **Link-check** `dist/`: every internal `href`/`src`/`url()` must resolve to an emitted file (all routes are pre-rendered, so no dynamic routes exist); hash-only and `mailto:` links are ignored. Report all offenders, exit non-zero.
9. **Emit** sitemap, robots, 404, search index (title + headings per page).
10. **Manifest** `dist/build.json` (slug, route, entry, file count) for smoke tests.

Determinism: no timestamps in output except `sitemap.xml` `lastmod` taken from `git log -1 --format=%cs` (or omitted outside git). Two consecutive builds produce identical file trees.

---

## 6. Shell and navigation

**Home:** short hero (what this collection is, one sentence), then one card per live course — title, promise, kind badge, hours, item count, "Start / Open" link. No carousel, no hero image, no feature grid.

**Course landing:** title + promise, metadata row (kind, hours, lessons/steps, last updated), "Start here" primary action, contents list, assessments list, and — for `app` courses — a note that the course opens in its own full-screen UI.

**Mounted apps:** untouched except one fixed bottom-left pill (`All courses ↗` → `/`), 32 px tall, inherits no styles, `z-index` high, honours `prefers-reduced-motion`. The decoder/decision rails keep their own step navigation.

**Lesson page:** three regions — left rail (course contents, current lesson marked), main column max 72ch, right margin (on-this-page). Mobile: rail collapses to a `<details>`.

**Visual system:** reuse the existing dark editorial language (near-black `#0a0a0b`, `#ecebe7` ink, gold `#e2b055` accent, system sans + serif display). Shell CSS is ~200 lines, no framework, no webfonts. Mounted courses keep their own type and colour.

**Accessibility:** one `<h1>` per page, landmark regions, skip link, visible focus rings, `aria-current` on active nav, 4.5:1 body contrast, no motion beyond 150 ms transitions, assessment controls as `<fieldset>/<legend>`.

**Per-page metadata:** `<title>` = `<page> · Learning`; `meta description` from the course `promise` or lesson `summary`; one shared favicon (inline SVG data URI); `og:title`/`og:description` on home and course landings. No analytics, no cookies.

**Responsive:** 360 / 768 / 1024 / 1440 verified; no horizontal scroll at 360; tap targets ≥ 44 px.

---

## 7. Assessment engine (`engine: "items"`)

JSON file:

```jsonc
{
  "id": "decision-check",
  "title": "Assess yourself",
  "intro": "No definitions. Each item separates two situations that look the same.",
  "passRatio": 0.7,
  "items": [
    {
      "id": "q1",
      "prompt": "Which number separates a calibrated score from a confident one?",
      "options": [ { "id": "a", "text": "…" }, { "id": "b", "text": "…" } ],
      "answer": "b",
      "explanation": "…why the right answer is right and the tempting one is tempting…",
      "teach": { "label": "Step 06 · calibration", "href": "/courses/decision-models/#calibration" }
    }
  ]
}
```

Behaviour: one item at a time; the option set is disabled until you commit; on commit, reveal correct/incorrect plus `explanation` and the `teach` link; `Next` advances; final screen shows score, pass/fail against `passRatio`, and a list of misses with teach links. State persists in `localStorage[progressKey]` so a reload resumes. Keyboard-only usable; result announced via `aria-live="polite"`.

`engine: "custom"` renders only a link card to the shipped HTML (the existing 18-item + 3-scenario assessment stays as-is).

---

## 8. Migration of the three sources

**One-off, scripted, verified after each step.**

| Target | From | Transform |
|---|---|---|
| `courses/decoder-course/app/` | `explorables/course.html`, `01…05-*.html`, `assets/*` | copy verbatim, filenames unchanged; rewrite the 6 links that pointed at the old explorables hub (`course.js:195`, and the foot link in each of `01…05-*.html`) from `index.html` to `../` so they return to the generated landing |
| `courses/decision-models/app/` | `explorables/decision-course.html`, `assessment.html`, `assets/dec*` | copy verbatim; rewrite `dec-assess.js:361` `index.html` → `../`; `decision-course.html#…` and `assessment.html` stay sibling links |
| `courses/python-decoder/` | `weeks/`, `mygpt/`, `tests/`, `SYLLABUS.md`, `CAPSTONE.md`, `INSTRUCTOR.md`, `README.md` | markdown → `lessons/` (frontmatter added: title, minutes, lab, solution, run); python tree copied verbatim |
| `courses/system-design/` | whole repo minus `.git`, `node_modules`, `dist`, `.github/workflows` | app mounted at `app/` (Vite `base: "./"` already works at any depth); `.github` Pages workflow not carried over |

No file is renamed and no asset path changes: the only edits are the seven hub links above, which the link-check and a browser pass verify.

`SOURCES.md` records: `llm-first-principles` @ `2332d00` (+ "explorables working tree, 2026-11-21 → 2026-11-23, uncommitted"), `system-design-first-principles` @ `f5648cc`.

The original repos are left untouched and functional. `llm-first-principles` README gets a one-line "superseded by `learning`" note only after the Cloudflare URL passes acceptance; nothing is archived or deleted.

---

## 9. Deployment

```jsonc
// wrangler.jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "learning",
  "compatibility_date": "2026-11-24",
  "assets": { "directory": "./dist", "not_found_handling": "404-page" }
}
```

- **Auth (once):** `npx wrangler login` → browser approval → session in `~/.wrangler`.
- **Deploy:** `npm run deploy` → `npm run build && npx wrangler deploy` → `https://learning.<account-subdomain>.workers.dev`.
- **Rollback:** `npx wrangler rollback` (previous version) — no rebuild needed.
- **CI (deferred):** GitHub Action on `main` with `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` secrets, running `validate`, `build`, `deploy`. Not required for v1.
- **Custom domain (deferred):** attach in dashboard; no code change.
- **Cutover:** GitHub Pages for `system-design-first-principles` gets a `README`/site banner pointing at the new URL after acceptance; the Pages workflow stays in the old repo until then.

`/courses/system-design/` ships without Supabase env values. The app is local-first by design; the sync path stays wired but dormant, exactly as it is today.

---

## 10. Verification and acceptance

Automated (must pass):

1. `npm run validate` — schema, slug/order uniqueness, entry files, lesson ids.
2. `npm run build` twice → identical `dist` tree (hash comparison).
3. Link-check — zero unresolved internal links.
4. Fixture test — building `platform/__fixtures__/demo-course` in a temp registry makes it appear on the home page and at `/courses/demo-course/` with no code edits.
5. Route smoke — start `platform/site/dev.mjs` against `dist`, `fetch` each route from `build.json`: 200 and expected `<title>`.
6. `dist` size budget: ≤ 8 MB total, no single asset > 2 MB.

Manual, in a browser (Chrome DevTools MCP):

7. Decoder course: step rail populated, next/prev works, one lab interaction changes a number.
8. Decision course: step navigation works, assessment page loads.
9. Python lesson page: `lab.py` panel renders with copy button, prev/next crosses weeks.
10. System-design: home renders, one module opens, arena page loads.
11. Pill appears on all mounted apps and returns to `/`.
12. 360 px viewport: no horizontal scroll on home, course landing, lesson.
13. Keyboard-only pass on home + one lesson + one assessment.

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Split of `explorables/` breaks a relative link | Mount = copy, not rewrite; link-check runs over the mounted tree; browser check on both courses |
| `course.js`/`dec-course.js` reference `index.html` as the hub | Rewrite those constants during migration, then assert with a grep in build (fail if a mounted app links outside its own dir except the declared cross-links) |
| Duplicated assets (~240 KB/course) drift | Accepted: courses stay self-contained; a future shared `assets/` refactor is a per-course change, not a platform one |
| Vite build inside `courses/system-design` slows CI | Cache `node_modules`; the rest of the build is ms |
| Public solutions reveal answers | Accepted explicitly (D6) |
| Cloudflare account/subdomain unknown | First deploy is interactive; if no account exists, `wrangler login` walks through creation before any other work is blocked |
| Node version differences | `engines: >=22` in `package.json`; build uses only stdlib + `marked` + `zod` |

---

## 12. Extension points (deliberately out of scope)

- Search UI over the emitted `search-index.json`.
- Cross-course progress dashboard on the home page (needs a per-course progress adapter contract).
- Video/embed course kind (frontmatter `video:` + a manifest kind).
- Authenticated sync (Supabase or Workers KV) replacing `localStorage`.
- Scenario assessment schema generalising the bespoke priced-decision sims.
