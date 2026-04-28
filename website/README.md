# Bigodin docs site

Docusaurus 3 site for [Bigodin](https://github.com/JPBM135/bigodin), published to GitHub Pages.

The user-facing markdown lives in the repo root (`README.md`, `LIB.md`, `LANGUAGE.md`, `HELPERS.md`, `CONTRIBUTING.md`) and the `mustache-compat/` directory. `scripts/sync-docs.js` copies them into `website/docs/` with frontmatter and rewritten links. The synced files are gitignored, regenerate before each build.

## Develop

From the repo root (the workspace handles the rest):

```bash
yarn docs:dev    # sync docs, then docusaurus start
yarn docs:build  # sync docs, then docusaurus build
yarn docs:serve  # serve the production build
```

Or, inside `website/`:

```bash
yarn start
yarn build
```

`prestart` and `prebuild` invoke `node ../scripts/sync-docs.js` automatically.

## Deploy

`.github/workflows/deploy-docs.yml` builds the site and publishes to GitHub Pages on every push to `main` that touches the docs sources, the website, or the workflow itself.

## Edit a page

Most docs are auto-generated, edit the source markdown in the repo root (or `mustache-compat/`), not the synced copy under `website/docs/`. The "Edit this page" link at the bottom of each doc points at the right file on GitHub.
