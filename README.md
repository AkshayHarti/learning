# learning

One public repo for interactive courses, written lessons and assessments.
Static site, deployed on Cloudflare.

- **Spec:** `docs/specs/2026-11-24-learning-platform-design.md`
- **Plan:** `docs/plans/2026-11-24-learning-platform.md`

```bash
npm install
npm run dev      # rebuild on change, serve http://localhost:4321
npm run build    # render dist/
npm run validate # manifests + internal links only
npm run deploy   # build, then wrangler deploy
```

Adding a course: `npm run new -- my-course`, then fill `courses/my-course/course.json`.
See `docs/ADDING-A-COURSE.md` (written in Task 12).
