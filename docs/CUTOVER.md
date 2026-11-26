# Cutover

The learning site replaced four separate places the courses used to live.

| Was | Now |
| --- | --- |
| `llm-first-principles` (repo + its GitHub Pages hub) | `/courses/decoder-course/`, `/courses/decision-models/`, `/courses/python-decoder/` |
| `system-design-first-principles` (GitHub Pages) | `/courses/system-design/` |

**Canonical URL:** https://learning.akshay-r555.workers.dev
**Source:** https://github.com/AkshayHarti/learning
**Deployed:** 2026-11-26, after the acceptance checks in
[docs/ARCHITECTURE.md](ARCHITECTURE.md#deployed) passed on the live origin.

## What happens to the old homes

- **`llm-first-principles`** is superseded but left intact. Its `README.md`
  carries a one-line pointer to this repo; nothing is archived, deleted or
  rewritten. The working tree still holds the original `explorables/` sources
  that the mounted courses were copied from, which is the point: `SOURCES.md`
  names a commit and those sources still resolve.
- **`system-design-first-principles`** keeps its GitHub Pages deploy, with a
  banner linking to the new course page. It is a working copy of the app, not the
  canonical one; the mounted copy under `courses/system-design/app/` is the one
  this site builds.
- Old deep links are not redirected. GitHub Pages cannot redirect from a static
  site without a Worker or a meta-refresh page per URL, and a half-done redirect
  layer is worse than a banner. Anyone arriving from an old link sees the banner.

## Rollback

Wrangler keeps every version. To go back to the previous deploy:

```bash
npx wrangler rollback            # interactively pick a version
npx wrangler deployments list    # see what is available
```

The site is static, so a rollback is exact: no database state, no migrations.
Rolling back further than the first deploy is not possible — there is nothing
before it, and the previous GitHub Pages sites stay up as the older fallback.

## If the domain changes

1. Point the new domain at the Worker (Workers → Custom Domains), or keep
   `*.workers.dev`.
2. Set `SITE_URL=https://new.example npm run build` so `sitemap.xml` and
   `robots.txt` carry absolute URLs.
3. Update the canonical URL in `README.md`, `SOURCES.md`, this file, and the two
   banners in the old repos.
4. `npm run deploy`.
