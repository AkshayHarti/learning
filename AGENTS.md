# Repo rules

- `dist/` is build output. Never hand-edit it; it is gitignored.
- A course lives entirely in `courses/<slug>/`. If a change requires editing
  `platform/`, it is a platform change and needs a test in `platform/build/`.
- `courses/<slug>/app/**` is mounted byte-identical except the injected
  `<!--learning-pill-->` block. Never rename or move files inside a mounted app.
- New courses come from the template: `npm run new -- <slug>`. Do not hand-copy
  `templates/course/` or hand-write a manifest — the script sets the slug,
  title and a free `order`, and the template stays the single source of truth.
- `templates/course/` must always build. It is exercised by
  `scripts/new-course.test.mjs`; a template edit that breaks the pipeline breaks
  that test.
- Manifest keys are strict: an unknown field fails discovery rather than being
  ignored. Add the field to `platform/build/schema.mjs` first.
- Every new module gets a failing test first (`node --test`).
- Run `npm run validate && npm test` before every commit.
- The build must stay deterministic: two consecutive builds produce identical trees.

## Where to look

- `docs/ARCHITECTURE.md` — pipeline, URL map, where a change belongs.
- `docs/ADDING-A-COURSE.md` — manifest fields and the authoring workflow.
- `SOURCES.md` — provenance for every course; the only place import paths live.
