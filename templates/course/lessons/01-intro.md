---
title: Start here
minutes: 10
summary: A starter lesson you are meant to delete.
---

# Start here

This is a starter course. It exists so the platform has something valid to
render before you have written anything: one lesson, one assessment, no
configuration to memorise.

Three files are yours now:

1. `course.json` — the manifest. `promise` is the one sentence a visitor reads
   before deciding to start. `lessons.order` decides the order; every id must
   name a real file in `lessons/`.
2. `lessons/01-intro.md` — this file. Frontmatter carries `title`, `minutes`
   and an optional `summary`; everything below it is markdown.
3. `assessments/check.json` — three questions. Replace them, or delete the
   assessment from the manifest if this course does not need one.

## What the build does with it

Every `course.json` under `courses/` is discovered at build time. There is no
route table to edit, no navigation to update: adding the directory is the whole
registration step.

## Writing a lesson

Ordinary markdown works: headings become the table of contents, tables and
fenced code blocks are rendered as code. A lab or a worked solution declared in
frontmatter gets its own panel with a copy button — a plain code block does not.

```python
def bits(p):
    """Shannon entropy, in bits."""
    return -sum(x * math.log2(x) for x in p if x > 0)
```

If the lesson belongs to a lab you ship in the repo, point at it:

```yaml
---
title: Week 1
minutes: 300
lab: labs/w01/lab.py
solution: labs/w01/solutions/lab.py
run: uv run pytest labs/w01
---
```

The lab and its worked solution are then rendered on the page, and `run` shows
as a "Run it locally" callout — the platform never executes your code.

Replace this file with your first real lesson.
