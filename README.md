# SabatKu books

Pustaka digital: karya, edisi bahasa, bab, cover, dan binding bacaan pekanan.

Status (2026-10-12): the catalog contains full hosted Indonesian *Kasih di Tengah Kobaran Konflik* and English *Love Under Fire* editions, Indonesian *Mission Quarterlies* Q4 2026 books for children and youth/adults, and the 2026 Indonesian *Bacaan Persembahan dan Persepuluhan* booklet. Mission stories and the 52 weekly stewardship readings are bundled for offline reading in Android; the other hosted editions can be downloaded through the app's verified cache. Web reading remains online-only. This app-managed cache is not a portable `.skpack` package. Studio-based package publishing remains postponed because hosting/server budget is unavailable; the current publisher is GitHub Pages.

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

## Mission Quarterlies

Mission stories are represented as two continuing book works: `Cerita Misi Anak` and `Cerita Misi Pemuda & Dewasa`. Each year/quarter/language is a separate edition with one dated chapter for each Sabbath. Quarter/year and chapter date/country are structured metadata, so Android can show them in the book details and table of contents. The Q4 2026 Indonesian editions are also bundled in Android assets for first-install offline reading.

To add a later issue, provide the prepared SQLite database and JPG or PNG covers for both audiences. The importer verifies each cover's image signature, reads the database in read-only mode, validates 13 Saturday stories for each audience on matching dates, converts passive paragraph HTML to Markdown, and updates the Android asset bundle:

```powershell
python scripts/import-mission-stories.py `
  --database "C:\path\to\mission-stories.sqlite" `
  --year 2027 --quarter 1 `
  --cover-children "C:\path\to\children-cover.png" `
  --cover-youth-adult "C:\path\to\youth-adult-cover.png"
```

For an editorial correction, use a new `--revision` value and `--replace` so an already published revision remains immutable. Then run `npm run build:content` and release the matching Android update so both catalogs contain the new issue. The importer rejects unexpected audiences, unsafe HTML, incomplete weekly sets, non-Sabbath dates, and mismatched child/adult date ranges.

## Tithe and Offering Readings

The 2026 booklet is one annual book edition in the `Bacaan Persembahan dan Persepuluhan` collection, with one dated chapter for every Sabbath (52 readings). The full Indonesian text and supplied cover are bundled in Android for offline reading; the official Stewardship Ministries landing page and PDF remain linked in book details. The content is separate from daily devotionals and Sabbath School lessons. The importer is pinned to the official 2026 source and validates its dates, Indonesian language, titles, passive HTML, and JPEG cover before updating both repositories:

```powershell
py -3 scripts/import-stewardship-readings.py `
  --database "C:\path\to\persembahan_2026_final.sqlite" `
  --cover "C:\path\to\cover_persembahan.jpeg" `
  --year 2026
npm run build:content
```

The official booklet allows translation and reproduction by Seventh-day Adventist entities with attribution to Stewardship Ministries. A later annual volume needs its own source/rights review and edition metadata before import.

## Architecture

See [library blueprint](https://github.com/AiWerek-Tech/sabatku-docs/blob/main/architecture/digital-library-blueprint.md) and [taxonomy/publications](https://github.com/AiWerek-Tech/sabatku-docs/blob/main/architecture/library-taxonomy-and-publications.md).
