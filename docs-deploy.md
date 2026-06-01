# Deploying the documentation site (docs.swells.app)

The docs site is built with **MkDocs** + **Material for MkDocs** and hosted on
**Cloudflare Pages** at `docs.swells.app`. It builds from this repo
(`dataforaction-tom/undercurrent`); the repo root is the `app/` folder, so
`mkdocs.yml`, `requirements.txt`, and `docs/` all sit at the top of the repo.

This is separate from the Next.js app deploy — same repo, different build.

## Source files

| File | Purpose |
|------|---------|
| `mkdocs.yml` | Site config (nav, theme, `site_url`, excludes `docs/plans/`) |
| `docs/index.md`, `docs/user-guide.md`, `docs/changelog.md` | The published pages |
| `requirements.txt` | Pinned build toolchain (`mkdocs`, `mkdocs-material`) |
| `docs/.docs-state.json` | Tracks the last commit the docs were updated against |
| `docs/plans/` | Internal design/plan docs — intentionally excluded from the site |

The generated `site/` directory is git-ignored; Cloudflare builds it on deploy.

## Local preview

`mkdocs` is invoked as a Python module (it may not be on PATH as `mkdocs`):

```bash
python -m pip install -r requirements.txt   # first time only
python -m mkdocs serve                       # preview at http://127.0.0.1:8000
python -m mkdocs build --strict              # verify a clean production build
```

## Cloudflare Pages — one-time setup

1. **Create the project**: Cloudflare dashboard → Workers & Pages → Create →
   Pages → Connect to Git → select `dataforaction-tom/undercurrent`.
2. **Build settings**:
   - Production branch: `master`
   - Framework preset: **None**
   - Build command: `pip install -r requirements.txt && mkdocs build`
   - Build output directory: `site`
   - Root directory: `/` (repo root — where `mkdocs.yml` lives)
3. **Build environment variable**:
   - `PYTHON_VERSION` = `3.12` (Material for MkDocs 9.x needs Python ≥ 3.9)
4. **Save & Deploy** — confirm the site renders at the generated `*.pages.dev` URL.
5. **Custom domain**: project → Custom domains → Set up a domain →
   `docs.swells.app`. As `swells.app` is on Cloudflare DNS, the `CNAME`
   (`docs` → `<project>.pages.dev`) and SSL are provisioned automatically.

## Notes

- **Both the app and the docs build from this repo.** Every push to `master`
  triggers the app deploy *and* a Pages docs build. To rebuild docs only when
  they change, set **Settings → Builds → Build watch paths** to include
  `docs/*`, `mkdocs.yml`, and `requirements.txt`.
- Build logs show a harmless "MkDocs 1.x unmaintained / 2.0 incompatible"
  banner from Material — an upstream notice, not a build error.
- Keep `requirements.txt` pins in step with the versions you verify locally so
  the Cloudflare build matches your machine.

## Updating the content

Use the `docs-updater` skill ("update docs") after a batch of changes. It
updates `docs/user-guide.md` + `docs/changelog.md` and records the commit in
`docs/.docs-state.json`, so the next run only documents what's new.
