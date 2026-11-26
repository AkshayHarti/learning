# Your course

This directory was copied from `templates/course/`. Everything a course needs
lives here — no other file in the repo has to change for it to appear on the
site.

## The four things to edit

| File | What it decides |
| --- | --- |
| `course.json` | slug, title, the one-sentence promise, order, hours, what is in the course |
| `lessons/*.md` | the written material; `lessons.order` in the manifest sets the sequence |
| `assessments/*.json` | questions (`engine: "items"`), or a bespoke page (`engine: "custom"`) |
| `app/` (optional) | a whole interactive app, mounted at `/courses/<slug>/app/` |

## Going live

The manifest ships as `"status": "draft"`, so nothing is published while you
write. Check the course locally:

```bash
npm run dev          # http://localhost:4321
```

Flip `status` to `"live"` when the first lesson is worth reading. Drafts are
validated on every build, so a broken draft still fails CI — that is deliberate:
a course that cannot render must not merge.

## Rules that are not negotiable

- `promise` is required and capped at 160 characters. It is the reason someone
  clicks.
- A lesson listed in `lessons.order` with no file fails the build, on purpose.
- An assessment with `engine: "items"` points at a JSON bank; the build refuses
  a bank whose `answer` is not one of its option ids.
- If the course has `app/`, the files inside it are mounted byte-identical. Do
  not rename or move them to make the site work — fix the links instead.
