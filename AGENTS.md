# Repo rules

- `dist/` is build output. Never hand-edit it; it is gitignored.
- A course lives entirely in `courses/<slug>/`. If a change requires editing
  `platform/`, it is a platform change and needs a test in `platform/build/`.
- `courses/<slug>/app/**` is mounted byte-identical except the injected
  `<!--learning-pill-->` block. Never rename or move files inside a mounted app.
- Every new module gets a failing test first (`node --test`).
- Run `npm run validate && npm test` before every commit.
- The build must stay deterministic: two consecutive builds produce identical trees.
