# Sources

Every course in `courses/` came from somewhere. This file records where, at
which commit, and how it is kept in sync.

The built site is deployed at
**https://learning.akshay-r555.workers.dev** (Cloudflare Workers static assets;
source **https://github.com/AkshayHarti/learning**). Deploy mechanics and the
live verification record are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#deployed);
what became of the original homes is in [docs/CUTOVER.md](docs/CUTOVER.md).

## Provenance

| Course | Source | Revision | Imported | Mechanism |
| --- | --- | --- | --- | --- |
| `decoder-course` | `~/workspace/repos/llm-first-principles` → `explorables/` | `2332d00` (2026-11-03) plus uncommitted explorables work, 2026-11-21 → 23 | 2026-11-24 | files copied into `courses/decoder-course/app/` |
| `decision-models` | same repo, `explorables/decision-course.html`, `assessment.html`, `DECISION-CURRICULUM.md`, `assets/dec-*` | same working tree | 2026-11-24 | files copied into `courses/decision-models/app/` |
| `python-decoder` | same repo, `SYLLABUS.md`, `INSTRUCTOR.md`, `CAPSTONE.md`, `weeks/`, `mygpt/`, `tests/` | `2332d00` (2026-11-03) | 2026-11-24 | `scripts/import-python-course.mjs` |
| `system-design` | `~/workspace/repos/system-design-first-principles` | `f5648cc` (2026-11-04) | 2026-11-24 | `npm run build` (Vite) at build time |

## The python course import

`scripts/import-python-course.mjs` is the only sanctioned way to refresh the
python course. It is one-way and idempotent:

```bash
node scripts/import-python-course.mjs            # reads ~/workspace/repos/llm-first-principles
node scripts/import-python-course.mjs --from DIR # or an explicit checkout
```

What it does:

1. Copies the runnable lab environment — `weeks/`, `mygpt/`, `tests/`,
   `pyproject.toml`, `Makefile` — into `courses/python-decoder/`, skipping
   `__pycache__/`, `.pytest_cache/`, `*.pyc` and other machine-local files.
2. Rewrites `SYLLABUS.md`, `INSTRUCTOR.md`, `CAPSTONE.md` and each
   `weeks/w0N_*/README.md` into `courses/python-decoder/lessons/<id>.md`,
   prepending frontmatter (`title`, `minutes`, `lab`, `solution`, `run`) and
   copying the body verbatim.

Bodies are never rewritten: if a lesson needs to change, it changes upstream
and is re-imported. `courses/python-decoder/course.json` is hand-authored and
lists the lesson order; `courses/python-decoder/course.test.mjs` fails if the
two disagree.

Two deliberate adaptations:

- `Makefile`'s `play` target is repointed at `../decoder-course/app/course.html`,
  because `explorables/` is no longer part of this course.
- A week README still *names* `explorables/01-entropy.html` and friends in its
  prose (body unchanged, per the plan). Those files are served from the decoder
  course, and this course's landing links there under "Contents".

## Not copied

- Python caches, virtualenvs and `.pytest_cache` — derived, machine-local.
- The old `explorables/index.html` hub page. Its five deep-dive pages and its
  simulation hub now live in `courses/decoder-course/app/`, and links that used
  to point at the hub were rewritten to the course landing (`../`).

## Deliberately published

The python course ships with what a normal course keeps private:

- `weeks/*/solutions/` — the reference implementations, rendered in a
  collapsed "Worked solution" panel beside the lab.
- `INSTRUCTOR.md` — the teaching notes, as a normal lesson.

This is a learning repo, not a graded one: a reader who gets stuck should be
able to see the answer without leaving the page.

## Template

`templates/course/` is original to this repo — no third-party source. It is
copied verbatim by `scripts/new-course.mjs`, and `scripts/new-course.test.mjs`
builds from it on every test run, so the template cannot rot unnoticed.
