# SabatKu books

Pustaka digital: karya, edisi bahasa, bab, cover, dan binding bacaan pekanan.

Status (2026-10-11): the published catalog contains full hosted Indonesian *Kasih di Tengah Kobaran Konflik* and English *Love Under Fire* editions. Their approved rights metadata permits Android offline caching; the app verifies chapter sizes and hashes. Web reading remains online-only. This app-managed cache is not a portable `.skpack` package. Studio-based book publishing and package delivery are postponed, not cancelled, because hosting/server budget is unavailable; there is no restart date. The current publisher is GitHub Pages.

## Commands

```sh
npm ci
npm run validate
npm test
npm run build:content
```

Published hosted editions are under `content/`; examples under `examples/` never enter public output. A work may also declare genuinely external language editions with `externalEditions`; those entries contain metadata and official source links only, without copying provider text. Both current *Love Under Fire* language editions are SabatKu-hosted and have explicit approved rights metadata. Canonical schemas/taxonomy are owned by `sabatku-contracts`; vendored snapshots have SHA-256 pins in `contracts/lock.json`. Deliberate contract upgrades must update snapshots and pins together.

## Publishing

GitHub Actions validates content/tests then builds an artifact. Push to main deploys only `public/` to GitHub Pages using GitHub Actions. Enable Pages → Source: GitHub Actions. Draft files are never served by Pages, but this public Git repository exposes committed source files; private editorial files must stay elsewhere.

Published revision files are immutable. Reuse of a revision ID for changed content is rejected when existing output is present; retain previous publication artifacts when releasing revisions. Catalog is generated last. Online chapters use Markdown; hashes and byte counts accompany files. Android verifies chapter hashes and byte counts before storing an offline copy. An edition is downloadable only when its rights status and `offlineAllowed` metadata approve it; external PDFs require their own explicit permission. Portable book packages and server-side package delivery remain future work.

## Architecture

See [library blueprint](https://github.com/AiWerek-Tech/sabatku-docs/blob/main/architecture/digital-library-blueprint.md) and [taxonomy/publications](https://github.com/AiWerek-Tech/sabatku-docs/blob/main/architecture/library-taxonomy-and-publications.md).
