# learning

One public repo for interactive courses, written lessons and assessments.
Static site, built from course directories, deployed on Cloudflare.

Live at **https://learning.akshay-r555.workers.dev** (Cloudflare Workers static
assets). Source: **https://github.com/AkshayHarti/learning**.

## Courses

| Course | Form | What it is |
| --- | --- | --- |
| [The decoder course](courses/decoder-course/) | 5 interactive labs + 12-step hub | Next-token prediction to alignment, every simulation local |
| [Decision models](courses/decision-models/) | 10 steps + bespoke assessment | Separating a calibrated judgement from a confident guess |
| [Build an LLM from first principles](courses/python-decoder/) | 11 lessons + runnable labs | Eight weeks of numpy and pytest: tokenizer, attention, training, serving, evals |
| [System design, from first principles](courses/system-design/) | React app, 6 stages per module | Derive the numbers, break the system, defend the tradeoff |

## Commands

```bash
npm install
npm run dev       # rebuild on change, serve http://localhost:4321
npm run build     # render dist/
npm run validate  # manifests + internal links, no output written
npm test          # node --test (no framework)
npm run deploy    # build, then wrangler deploy
```

Requires Node ≥ 22. The only runtime dependencies are `marked` and `zod`;
`wrangler` is a dev dependency.

Deploying needs a Cloudflare login once (`npx wrangler login`), then every
`npm run deploy` uploads `dist/` as static assets — no Worker script, no
bindings, no database. `wrangler.jsonc` is the whole server configuration.

## Adding a course

```bash
npm run new -- my-course      # copies templates/course → courses/my-course
npm run dev                   # edit course.json and lessons/01-intro.md
npm run validate && npm test  # then flip status to "live"
```

That is the whole registration step: discovery scans `courses/*/course.json`,
and there is no route table, navigation file or list to update. A new course
ships as a draft so it cannot go live by accident.

Full reference: **[docs/ADDING-A-COURSE.md](docs/ADDING-A-COURSE.md)**.

The courses previously lived in two separate repos (`llm-first-principles`,
`system-design-first-principles`) and were consolidated here. What happened to
those homes, and how to roll back a deploy, is in
[docs/CUTOVER.md](docs/CUTOVER.md).

## How it fits together

```
courses/<slug>/course.json ──▶ discover ──▶ build ──▶ dist/ ──▶ Cloudflare
```

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — pipeline, URL map, where a change belongs.
- [docs/ADDING-A-COURSE.md](docs/ADDING-A-COURSE.md) — manifest fields, lessons, assessments, mounted apps.
- [docs/specs/2026-11-24-learning-platform-design.md](docs/specs/2026-11-24-learning-platform-design.md) — the design and its rulings.
- [SOURCES.md](SOURCES.md) — where each course came from, at which commit.

Mounted apps are copies of their original code with exactly one injected block
(the "All courses" pill); they are not rewritten to fit the site.

## Licence

MIT for the platform. Course prose and code retain their original authorship —
see [SOURCES.md](SOURCES.md).
