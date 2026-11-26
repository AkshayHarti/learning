# Adding a course

```bash
npm run new -- my-course      # copies templates/course → courses/my-course
npm run dev                   # http://localhost:4321
```

That is the whole registration step. Discovery scans `courses/*/course.json` on
every build — there is no route table, no navigation file and no list to append
to. A course that exists in the directory exists on the site; a course with
`"status": "draft"` is validated but not published.

## The manifest

`courses/<slug>/course.json`, validated by `platform/build/schema.mjs` (zod).
Unknown keys are rejected, so a typo fails the build instead of being ignored.

| Field | Required | Meaning |
| --- | --- | --- |
| `slug` | yes | `/courses/<slug>/`; lowercase, digits, dashes; must equal the directory name |
| `title` | yes | Human name, shown on the landing cards and in the rail |
| `promise` | yes | One sentence, ≤160 chars. The reason someone clicks |
| `kind` | yes | `lessons`, `app` or `hybrid` |
| `status` | no (default `live`) | `live` renders; `draft` validates and publishes nothing |
| `order` | yes | Sort key for the landing page; `new` picks the next free ten |
| `hours` | no | Estimated effort, shown on the card |
| `tags` | no | Free-form labels, currently informational |
| `lessons` | required for `lessons`/`hybrid` | `{ "root": "lessons", "order": ["01-intro", …] }` |
| `app` | required for `app`/`hybrid` | `{ "entry": "course.html", "build": "vite"? }` |
| `assessments` | no | see below |
| `contents` | no | extra links on the landing page |
| `progressKey` | no | `localStorage` namespace; defaults to `learning:<slug>:v1` |

`kind` is not decoration: it decides which of `lessons`/`app` is mandatory, and
the build refuses a `lessons` course with no lesson directory or an `app` course
with no entry file.

## Lessons

One markdown file per lesson in `lessons/`. `lessons.order` is the sequence, and
every id in it must name a real file — a missing one fails the build rather than
silently disappearing from the course.

Frontmatter (all optional except `title`):

```yaml
---
title: Week 1 — Prediction is compression
minutes: 300
summary: One line under the heading.
lab: weeks/w01_prediction/lab.py             # path inside the course directory
solution: weeks/w01_prediction/solutions/lab.py
run: uv run pytest weeks/w01_prediction       # shown as a "Run it locally" callout
---
```

`lab` and `solution` are rendered as code panels with copy buttons; `run` is
displayed, never executed. The platform does not run anything a course ships.

Cross-course links may start with `/` (`/courses/decoder-course/app/course.html`);
the link checker verifies they resolve in the built tree.

## Assessments

Two engines, and the difference is deliberate.

**`engine: "items"` — a JSON item bank.** Use this for new assessments.

```json
{
  "id": "check",
  "title": "Check yourself",
  "engine": "items",
  "file": "assessments/check.json"
}
```

The bank:

```json
{
  "id": "check",
  "title": "Check yourself",
  "intro": "Optional line above the first question.",
  "passRatio": 0.6,
  "items": [
    {
      "id": "registration",
      "prompt": "What registers a course with the site?",
      "options": [
        { "id": "a", "text": "Adding a directory…" },
        { "id": "b", "text": "Adding a route…" }
      ],
      "answer": "a",
      "explanation": "Why the answer is the answer.",
      "teach": { "href": "/courses/my-course/01-intro.html", "label": "Revisit the lesson" }
    }
  ]
}
```

The bank is rendered into `/courses/<slug>/a/<id>.html` at build time. Progress
goes to `localStorage` under the course's `progressKey`: answers survive a
reload, and "Start over" clears them.

**`engine: "custom"` — a page you wrote.** Use this only when the assessment is
genuinely interactive (the decision-models course ships one).

```json
{ "id": "assessment", "title": "Assessment", "engine": "custom", "href": "assessment.html" }
```

`href` is relative to the course directory, and the file is normally inside
`app/`, so it is mounted with the rest of the app.

## Interactive apps

`kind: "app"` or `"hybrid"` mounts a whole app at `/courses/<slug>/app/`.
Two rules:

1. **The files are mounted byte-identical** (plus the injected
   `<!--learning-pill-->` block). If the site needs a change, fix the app —
   never rename or move its files.
2. **The app must already be portable**: relative asset paths or `base: "./"`,
   and hash routing if it has routes. A mounted app cannot rely on server
   rewrites.

If the app is a Vite build, set `"build": "vite"`. The platform runs
`npm ci && npm run build` inside the app directory on every build and mounts
`dist/`, so `node_modules` and sources never reach the deployed tree.

## Drafts, validation and shipping

- `"status": "draft"` publishes nothing; the course is still validated, so a
  broken draft fails CI. A course that cannot render must not merge.
- `npm run validate` — manifests and course-internal links, no output written.
- `npm run build` — the full pipeline; fails on an invalid manifest, a broken
  internal link, or a Vite app that does not compile.
- `npm test` — includes a fixture repo that runs the whole pipeline from
  `templates/course`, which is how the template is guaranteed to stay valid.

## Checklist for a new course

- [ ] `npm run new -- <slug>`
- [ ] `course.json`: real `title`, one-sentence `promise`, `hours`, `order`
- [ ] `lessons.order` matches the files, and every lesson has `title`/`minutes`
- [ ] delete the sample assessment or replace its items
- [ ] `npm run dev`, read it as a learner at 320px and 1440px
- [ ] flip `status` to `live`
- [ ] `npm run validate && npm test`
