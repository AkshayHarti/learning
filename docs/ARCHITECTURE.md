# Architecture

A course is a directory. The site is a build over the directories. There is no
database, no server code and no runtime configuration — `dist/` is static files
and that is the whole deployment.

```
courses/<slug>/
  course.json        manifest — the only registration mechanism
  lessons/*.md       markdown with frontmatter
  assessments/*.json item banks for engine: "items"
  app/               optional interactive app, mounted verbatim
        │
        ▼
  discover.mjs   scan courses/*/course.json, validate with zod,
        │        normalise into the Course shape, sort by order
        ▼
  build.mjs      home → per-course landing → lessons → assessments
        │        → app mount (copy or Vite build) → meta → link check
        ▼
  dist/          index.html, courses/**, assets/**, sitemap.xml,
                 robots.txt, 404.html, search-index.json, build.json
```

Two invariants make the platform honest:

- **The manifest is the only input.** Adding a course is adding a directory.
  Nothing in `platform/` names a course; nothing in the build has a route table.
- **The build fails rather than ships.** Invalid manifests throw before anything
  is written; a broken internal link throws after the render; a Vite app that
  does not compile throws with the tail of its log. CI cannot publish a
  half-site.

## Stages

| Stage | Module | What it decides |
| --- | --- | --- |
| Discover | `discover.mjs` + `schema.mjs` | which courses exist, their order, whether they are live or draft, and every manifest error at once |
| Render | `render-home.mjs`, `render-course.mjs`, `render-lessons.mjs`, `render-assessments.mjs` | the pages, using `platform/site/layout.mjs` for shared chrome |
| Mount | `mount-app.mjs` | copies `app/` into `dist/courses/<slug>/app/`, skipping `node_modules`, `dist`, `.git`, `.claude`; injects the "All courses" pill after `<!--learning-pill-->`; adds an `index.html` redirect when the entry is not `index.html` |
| Build app | `build.mjs` → `buildViteApp` | for `app.build: "vite"`: runs `npm ci && npm run build` in the app directory and mounts its `dist/`, so sources and `node_modules` never ship |
| Emit | `emit.mjs` | `sitemap.xml`, `robots.txt`, `404.html`, `search-index.json`, `build.json` |
| Check | `linkcheck.mjs` | every relative `href`/`src` in the output resolves to a file in the output |

`npm run validate` runs discover + the link-free part of the checks without
writing anything; `npm run build` runs the whole pipeline.

## URL map

| URL | Served from | Notes |
| --- | --- | --- |
| `/` | `index.html` | landing page; owns the directory root |
| `/courses/<slug>/` | `courses/<slug>/index.html` | course landing |
| `/courses/<slug>/<lesson-id>.html` | one file per lesson | ids come from `lessons.order` |
| `/courses/<slug>/a/<assessment-id>.html` | generated from a JSON bank | `engine: "items"` |
| `/courses/<slug>/app/**` | byte-identical copy of `courses/<slug>/app/**` | `engine: "custom"` assessments usually live here too |
| `/assets/**` | `platform/site/*` | shared shell CSS/JS and the assessment engine |

Every course is namespaced under `/courses/<slug>/`, so a course can own a
`README.md`, a `course.html`, a `01-entropy.html` and an `assets/` directory
without ever colliding with the platform's own paths.

On Cloudflare, a request for a `*.html` path answers `307` to the extensionless
form (`/courses/x/w01.html` → `/courses/x/w01`, `200` with the same file): Workers
static assets canonicalise HTML with `auto-trailing-slash`. The content and the
fragment survive the hop. Directory roots (`/courses/x/`) are served directly from
`index.html`. Making the emitted links extensionless would remove that hop —
tracked as a follow-up, not a defect in the output.

## Deployed

Live origin: **https://learning.akshay-r555.workers.dev** (first deploy 2026-11-26).

- `wrangler.jsonc`: `assets.directory = ./dist`, `not_found_handling = "404-page"`,
  no `main`, so the Worker has no script and no bindings. `npx wrangler deploy --dry-run`
  reports a 0.31 KiB placeholder and no bindings.
- Deploy: `npx wrangler login` once, then `npm run deploy` (build, then upload).

Verified on the live origin 2026-11-26 in Chromium:

| # | Check | Result |
| --- | --- | --- |
| 1 | `/` | 4 cards in order, no console errors |
| 2 | `/courses/decoder-course/` | 5 labs listed; `app/course.html` rail of 12; next advances `#prediction` → `#tokens`; entropy slider 100 → 990 moved surprisal 8.97 → 0.10 bits |
| 3 | `/courses/decision-models/app/assessment.html` | 18 items + 3 scenarios; commit → verdict; threshold lab at 0.80 revealed cost/case 10.250 and "64.43× the minimum" |
| 4 | `/courses/python-decoder/w01.html` | lab + worked-solution panels, 2 copy buttons, next → w02, rail marks current page |
| 5 | `/courses/system-design/app/` | home, module `#/m/latency-and-estimation` with 6 stages, `#/arena` with drill prompts |
| 6 | pill on mounted apps | visible, topmost, `href="/"`, returns to `/` |
| 7 | 360 px: home, landing, lesson | no horizontal scroll (after the fix below) |
| 8 | keyboard only | Tab+Enter: home → course → app; Space checks an assessment radio, Tab+Enter commits it |

Fix found by check 7: at 360 px the python lessons scrolled horizontally because
a wide table and a long inline identifier could not shrink. `platform/site/shell.css`
now lets `.prose` tables and code blocks scroll inside their own box and allows
inline code to break (`overflow-wrap: anywhere`). Re-verified: page `scrollWidth`
equals viewport on `/`, the decoder landing, `w01`, and `syllabus`.

## Mounted apps

An app is mounted, not rewritten. Its files are byte-identical to the source
except for one injected block:

```html
<!--learning-pill-->
```

→ a fixed-position "All courses" link injected once, idempotently. Everything
else — script paths, hash routes, relative links — has to work as written.
That is why the two mounted apps use `base: "./"` and hash routing: they are
already portable, so the platform never edits them.

## Determinism

Two builds of the same commit produce identical trees. No timestamps are written
(`build.json` records the commit, not the clock), routes are emitted in a fixed
order, and `dist/` is removed before every build. `platform/build/determinism.test.mjs`
enforces it.

## Where a change belongs

| You want to change… | Edit | Test lives in |
| --- | --- | --- |
| a course's content | `courses/<slug>/` | the course's own `course.test.mjs` |
| how any page looks | `platform/site/` | `platform/build/*.test.mjs` |
| what the build produces | `platform/build/` | a test in `platform/build/` |
| the workflow for adding a course | `templates/course/`, `scripts/new-course.mjs` | `scripts/new-course.test.mjs` |

If a course change requires editing `platform/`, it is a platform change: it
needs a test, and it will affect every course.
