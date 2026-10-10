# SabatKu books

Pustaka digital: karya, edisi bahasa, bab, cover, dan binding bacaan pekanan.

Status: first published bilingual catalog record: Indonesian reading text for *Kasih di Tengah Kobaran Konflik* and a provider link to the English *Love Under Fire* edition. Android/Web online readers are integrated; offline book packages remain future work.

## Commands

```sh
npm ci
npm run validate
npm test
npm run build:content
```

Published Indonesian editions are under `content/`; examples under `examples/` never enter public output. A hosted Indonesian edition may declare provider-hosted language editions with `externalEditions`. The generated catalog lists each locale separately, while external entries contain only metadata and official source links; English text stays with its provider and is never copied here. Canonical schemas/taxonomy are owned by `sabatku-contracts`; vendored snapshots have SHA-256 pins in `contracts/lock.json`. Deliberate contract upgrades must update snapshots and pins together.

## Publishing

GitHub Actions validates content/tests then builds an artifact. Push to main deploys only `public/` to GitHub Pages using GitHub Actions. Enable Pages → Source: GitHub Actions. Draft files are never served by Pages, but this public Git repository exposes committed source files; private editorial files must stay elsewhere.

Published revision files are immutable. Reuse of a revision ID for changed content is rejected when existing output is present; retain previous publication artifacts when releasing revisions. Catalog is generated last. Online chapters use Markdown; hashes and byte counts accompany files. A content-level offline permission does not mean Android has installed/offline reader support; no complete offline book claim is made until client packaging exists.

## Architecture

See [library blueprint](https://github.com/AiWerek-Tech/sabatku-docs/blob/main/architecture/digital-library-blueprint.md) and [taxonomy/publications](https://github.com/AiWerek-Tech/sabatku-docs/blob/main/architecture/library-taxonomy-and-publications.md).
