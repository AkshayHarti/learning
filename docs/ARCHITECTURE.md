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
