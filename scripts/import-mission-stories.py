#!/usr/bin/env python3
"""Import a prepared Mission Quarterlies SQLite database into book editions.

The SQLite file is opened read-only. The importer creates canonical Markdown
chapters in sabatku-books and a matching, integrity-checked Android asset bundle.
"""

from __future__ import annotations

import argparse
import hashlib
import html
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import shutil
import sqlite3
import sys
from datetime import date


ROOT = Path(__file__).resolve().parent.parent
ANDROID_ROOT = ROOT.parent / "sabatku-android"
CATEGORY_MAP = {
    "anak-anak": {
        "audience": "children",
        "collection": "mission-stories-children",
        "work_id": "work:mission-stories:children",
        "work_title": "Cerita Misi Anak",
        "edition_suffix": "children",
        "archive_url": "https://adventistmission.org/mission-awareness/mission-quarterlies/children/articles",
        "archive_label": "Arsip Cerita Misi Anak Adventist Mission",
        "cover_arg": "cover_children",
        "attribution": "Adventist Mission; edisi Bahasa Indonesia SabatKu.",
        "description": "Kumpulan cerita misi mingguan untuk anak-anak dari fokus wilayah triwulan ini. Edisi ini memuat {count} cerita bertanggal Sabat dan dapat dibaca tanpa koneksi internet.",
    },
    "dewasa": {
        "audience": "young-adults",
        "collection": "mission-stories-youth-adult",
        "work_id": "work:mission-stories:youth-adult",
        "work_title": "Cerita Misi Pemuda & Dewasa",
        "edition_suffix": "youth-adult",
        "archive_url": "https://adventistmission.org/mission-awareness/mission-quarterlies/youth-and-adult/articles",
        "archive_label": "Arsip Cerita Misi Pemuda & Dewasa Adventist Mission",
        "cover_arg": "cover_youth_adult",
        "attribution": "Adventist Mission; edisi Bahasa Indonesia SabatKu.",
        "description": "Kumpulan cerita misi mingguan untuk pemuda dan dewasa dari fokus wilayah triwulan ini. Edisi ini memuat {count} cerita bertanggal Sabat dan dapat dibaca tanpa koneksi internet.",
    },
}
MONTHS_ID = ("Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember")
DAYS_ID = ("Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu")


class ParagraphExtractor(HTMLParser):
    """Convert the database's passive story paragraphs into safe Markdown."""

    allowed = {"p", "br", "em", "i", "strong", "b"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.paragraphs: list[str] = []
        self.current: list[str] = []
        self.inline_stack: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        if tag not in self.allowed:
            raise ValueError(f"Unsupported or unsafe HTML element: <{tag}>")
        if tag == "p":
            self._finish_paragraph()
        elif tag == "br":
            self.current.append(" ")
        elif tag in {"em", "i"}:
            self.current.append("*")
            self.inline_stack.append("*")
        elif tag in {"strong", "b"}:
            self.current.append("**")
            self.inline_stack.append("**")

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in {"em", "i", "strong", "b"}:
            marker = "**" if tag in {"strong", "b"} else "*"
            if self.inline_stack:
                self.inline_stack.pop()
            self.current.append(marker)
        elif tag == "p":
            self._finish_paragraph()

    def handle_data(self, data: str) -> None:
        self.current.append(data)

    def _finish_paragraph(self) -> None:
        text = " ".join("".join(self.current).split())
        if text:
            self.paragraphs.append(text)
        self.current.clear()
        self.inline_stack.clear()

    def result(self) -> str:
        self._finish_paragraph()
        return "\n\n".join(self.paragraphs).strip()


def parse_story_html(value: str, row_id: str) -> str:
    parser = ParagraphExtractor()
    try:
        parser.feed(value)
        parser.close()
    except Exception as error:
        raise ValueError(f"{row_id}: invalid story HTML: {error}") from error
    text = parser.result()
    if not text or "\x00" in text:
        raise ValueError(f"{row_id}: story body is empty or invalid")
    return text


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def cover_extension(path: Path) -> str:
    extension = path.suffix.lower()
    signature = path.read_bytes()[:8]
    valid = {
        ".jpg": signature.startswith(b"\xff\xd8\xff"),
        ".jpeg": signature.startswith(b"\xff\xd8\xff"),
        ".png": signature.startswith(b"\x89PNG\r\n\x1a\n"),
    }
    if extension not in valid or not valid[extension]:
        raise ValueError(f"Cover must be a valid JPG or PNG image: {path}")
    return ".jpg" if extension == ".jpeg" else extension


def sabbath_label(day: date) -> str:
    return f"{DAYS_ID[day.weekday()]}, {day.day} {MONTHS_ID[day.month - 1]} {day.year}"


def remove_duplicate_dateline(body: str, reading_date: date, country: str) -> str:
    paragraphs = body.split("\n\n", 1)
    if not paragraphs:
        return body
    first = " ".join(paragraphs[0].split())
    expected = f"{reading_date.day} {MONTHS_ID[reading_date.month - 1]} | {country}"
    if first.casefold() == expected.casefold():
        return paragraphs[1].strip() if len(paragraphs) > 1 else ""
    return body


def read_stories(database: Path, year: int, quarter: int) -> dict[str, list[dict[str, object]]]:
    if not database.is_file():
        raise ValueError(f"SQLite database not found: {database}")
    connection = sqlite3.connect(database.resolve().as_uri() + "?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    try:
        tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if "mission_stories" not in tables:
            raise ValueError("The SQLite database does not contain the mission_stories table.")
        rows = connection.execute(
            """SELECT id, category, sabbath_date, title, country, language_code,
                      year, quarter, body_html
                 FROM mission_stories
                WHERE year=? AND quarter=?
                ORDER BY sabbath_date, category""",
            (year, quarter),
        ).fetchall()
    finally:
        connection.close()

    result = {category: [] for category in CATEGORY_MAP}
    seen: set[tuple[str, str]] = set()
    for row in rows:
        if row["category"] not in result:
            raise ValueError(f"Unknown audience category: {row['category']}")
        if row["language_code"].lower() != "id":
            raise ValueError(f"{row['id']}: this importer expects Indonesian source text.")
        reading_date = date.fromisoformat(row["sabbath_date"].strip())
        if reading_date.year != year or (reading_date.month - 1) // 3 + 1 != quarter or reading_date.weekday() != 5:
            raise ValueError(f"{row['id']}: date must be a Saturday inside the requested quarter.")
        key = (row["category"], reading_date.isoformat())
        if key in seen:
            raise ValueError(f"Duplicate story date for audience: {key}")
        seen.add(key)
        title = " ".join(row["title"].split())
        country = " ".join((row["country"] or "").split())
        if not title or not country:
            raise ValueError(f"{row['id']}: every story needs a title and country.")
        body = remove_duplicate_dateline(parse_story_html(row["body_html"], row["id"]), reading_date, country)
        if not body:
            raise ValueError(f"{row['id']}: story body contains only a date and location.")
        label = sabbath_label(reading_date)
        result[row["category"]].append({
            "id": row["id"],
            "date": reading_date.isoformat(),
            "title": title,
            "country": country,
            "body": f"> **{label}** · {country}\n\n{body}\n",
        })

    date_sets: list[set[str]] = []
    for category, stories in result.items():
        stories.sort(key=lambda item: str(item["date"]))
        if len(stories) != 13:
            raise ValueError(f"Expected 13 weekly stories for {category}; found {len(stories)}.")
        dates = {str(story["date"]) for story in stories}
        date_sets.append(dates)
    if not date_sets[0] or date_sets[0] != date_sets[1]:
        raise ValueError("Children's and youth/adult editions must cover the same 13 Sabbath dates.")
    return result


def build_work_documents() -> list[tuple[Path, dict[str, object]]]:
    return [
        (ROOT / "content/id/mission-stories/works/children.json", {
            "kind": "work", "id": CATEGORY_MAP["anak-anak"]["work_id"],
            "key": "mission-stories-children", "title": "Cerita Misi Anak",
            "author": "Adventist Mission", "seriesIds": ["mission-quarterlies"],
        }),
        (ROOT / "content/id/mission-stories/works/youth-adult.json", {
            "kind": "work", "id": CATEGORY_MAP["dewasa"]["work_id"],
            "key": "mission-stories-youth-adult", "title": "Cerita Misi Pemuda & Dewasa",
            "author": "Adventist Mission", "seriesIds": ["mission-quarterlies"],
        }),
    ]


def edition_document(category: str, stories: list[dict[str, object]], year: int, quarter: int, revision: str, cover_suffix: str) -> dict[str, object]:
    config = CATEGORY_MAP[category]
    start_date = str(stories[0]["date"])
    end_date = str(stories[-1]["date"])
    edition_key = f"mission-stories-{config['edition_suffix']}-{year}-q{quarter}-id"
    edition_id = f"edition:mission-stories:{year}-q{quarter}:{config['edition_suffix']}:id"
    locale_title = "Anak" if category == "anak-anak" else "Pemuda & Dewasa"
    cover_name = f"cover{cover_suffix}"
    return {
        "kind": "edition",
        "id": edition_id,
        "key": edition_key,
        "workId": config["work_id"],
        "locale": "id",
        "title": f"Cerita Misi {locale_title} — Triwulan {quarter} {year}",
        "description": config["description"].format(count=len(stories)),
        "publicationPeriod": {
            "type": "quarterly", "year": year, "quarter": quarter,
            "cadence": "weekly", "startDate": start_date, "endDate": end_date,
        },
        "revision": revision,
        "status": "published",
        "rights": {
            "status": "verified",
            "attribution": config["attribution"],
            "offlineAllowed": True,
            "permissionNote": "Edisi Bahasa Indonesia ini disediakan untuk penerbitan dan pembacaan offline di SabatKu.",
        },
        "primaryThemeId": "mission-evangelism",
        "themeIds": ["mission-evangelism", "stories-testimonies"],
        "collectionIds": [config["collection"]],
        "audienceIds": [config["audience"]],
        "sources": [{
            "kind": "online-text", "label": config["archive_label"],
            "url": config["archive_url"], "primary": False, "offlineAllowed": False,
        }],
        "cover": f"assets/{cover_name}",
        "nodes": [
            {
                "id": f"story-{story['date']}",
                "title": story["title"],
                "nodeType": "chapter",
                "order": index,
                "readingDate": story["date"],
                "country": story["country"],
                "file": f"nodes/story-{story['date']}.md",
            }
            for index, story in enumerate(stories, start=1)
        ],
    }


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def prune_stale_android_revisions(android_assets: Path, year: int, quarter: int, current_revision: str) -> None:
    asset_root = android_assets.resolve()
    for audience in ("children", "youth-adult"):
        revisions = asset_root / "mission-stories" / f"{year}-q{quarter}-{audience}" / "revisions"
        revisions.resolve().relative_to(asset_root)
        if not revisions.is_dir():
            continue
        for revision_dir in revisions.iterdir():
            if not revision_dir.is_dir() or revision_dir.name == current_revision:
                continue
            if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", revision_dir.name):
                continue
            for asset in revision_dir.iterdir():
                if not asset.is_file():
                    continue
                if asset.name not in {"cover.jpg", "cover.png"} and not re.fullmatch(r"story-\d{4}-\d{2}-\d{2}\.md", asset.name):
                    continue
                asset.resolve().relative_to(asset_root)
                asset.unlink()
            try:
                revision_dir.rmdir()
            except OSError:
                pass
        try:
            revisions.rmdir()
        except OSError:
            pass


def import_editions(args: argparse.Namespace) -> None:
    stories_by_category = read_stories(args.database, args.year, args.quarter)
    work_documents = build_work_documents()
    for work_path, payload in work_documents:
        if work_path.exists():
            existing = json.loads(work_path.read_text(encoding="utf-8"))
            if existing != payload:
                raise ValueError(f"Work metadata differs from {work_path}; update it manually before importing editions.")
    plans: list[tuple[str, Path, dict[str, object], list[dict[str, object]], Path]] = []
    for category, stories in stories_by_category.items():
        config = CATEGORY_MAP[category]
        cover = getattr(args, config["cover_arg"]).resolve()
        if not cover.is_file():
            raise ValueError(f"Cover image not found: {cover}")
        cover_suffix = cover_extension(cover)
        folder = ROOT / f"content/id/mission-stories/{args.year}-q{args.quarter}-{config['edition_suffix']}"
        edition_path = folder / "edition.json"
        if edition_path.exists() and not args.replace:
            raise ValueError(f"Refusing to overwrite {edition_path}; pass --replace to update it.")
        plans.append((category, folder, edition_document(category, stories, args.year, args.quarter, args.revision, cover_suffix), stories, cover))

    android_assets = args.android_assets_root.resolve()
    existing_bundle: list[dict[str, object]] = []
    if not args.skip_android_assets:
        android_assets.mkdir(parents=True, exist_ok=True)
        index_path = android_assets / "mission-stories/index.json"
        if index_path.exists():
            existing_index = json.loads(index_path.read_text(encoding="utf-8"))
            if existing_index.get("schemaVersion") != 1 or not isinstance(existing_index.get("editions"), list):
                raise ValueError(f"Existing Android mission index is invalid: {index_path}")
            existing_bundle = existing_index["editions"]
    bundle_editions: list[dict[str, object]] = []

    for category, folder, edition, stories, cover in plans:
        if folder.exists() and args.replace:
            shutil.rmtree(folder)
        nodes_dir = folder / "nodes"
        assets_dir = folder / "assets"
        nodes_dir.mkdir(parents=True, exist_ok=True)
        assets_dir.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(cover, assets_dir / Path(str(edition["cover"])).name)
        write_json(folder / "edition.json", edition)
        for story in stories:
            (nodes_dir / f"story-{story['date']}.md").write_text(str(story["body"]), encoding="utf-8")

        bundle_book = {
            "id": edition["id"], "workId": edition["workId"], "title": edition["title"],
            "description": edition["description"], "locale": edition["locale"], "revision": edition["revision"],
            "author": "Adventist Mission", "attribution": edition["rights"]["attribution"],
            "offlineAllowed": True, "rightsStatus": "verified",
            "publicationPeriod": edition["publicationPeriod"],
            "primaryThemeId": edition["primaryThemeId"], "themeIds": edition["themeIds"],
            "collectionIds": edition["collectionIds"], "audienceIds": edition["audienceIds"],
            "seriesIds": ["mission-quarterlies"], "sources": edition["sources"],
            "bundledOffline": True,
        }
        bundle_prefix = f"mission-stories/{args.year}-q{args.quarter}-{CATEGORY_MAP[category]['edition_suffix']}/revisions/{args.revision}"
        chapters = []
        if not args.skip_android_assets:
            for index, story in enumerate(stories, start=1):
                chapter_path = android_assets / bundle_prefix / f"story-{story['date']}.md"
                chapter_path.parent.mkdir(parents=True, exist_ok=True)
                chapter_path.write_text(str(story["body"]), encoding="utf-8")
                chapters.append({
                    "id": f"story-{story['date']}", "title": story["title"], "order": index,
                    "nodeType": "chapter", "readingDate": story["date"], "country": story["country"],
                    "contentAssetPath": f"{bundle_prefix}/story-{story['date']}.md",
                    "bytes": chapter_path.stat().st_size, "sha256": sha256(chapter_path),
                })
                image = nodes_dir.parent / "assets" / f"story-{story['date']}.jpg"
                if image.is_file():
                    image_target = android_assets / bundle_prefix / image.name
                    shutil.copyfile(image, image_target)
                    chapters[-1]["imageAssetPath"] = f"{bundle_prefix}/{image.name}"
            cover_asset = android_assets / bundle_prefix / f"cover{cover_extension(cover)}"
            cover_asset.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(cover, cover_asset)
            bundle_editions.append({"book": bundle_book, "chapters": chapters, "coverAssetPath": f"{bundle_prefix}/cover{cover_extension(cover)}"})

    for work_path, payload in work_documents:
        write_json(work_path, payload)
    if not args.skip_android_assets:
        updated_book_ids = {entry["book"]["id"] for entry in bundle_editions}
        merged_bundle = [entry for entry in existing_bundle if entry["book"]["id"] not in updated_book_ids]
        merged_bundle.extend(bundle_editions)
        merged_bundle.sort(key=lambda entry: (entry["book"]["publicationPeriod"]["year"], entry["book"]["publicationPeriod"]["quarter"], entry["book"]["workId"]))
        write_json(android_assets / "mission-stories/index.json", {"schemaVersion": 1, "editions": merged_bundle})
        prune_stale_android_revisions(android_assets, args.year, args.quarter, args.revision)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", type=Path, required=True, help="Prepared mission_stories SQLite file")
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--quarter", type=int, choices=range(1, 5), required=True)
    parser.add_argument("--revision", default="1")
    parser.add_argument("--cover-children", type=Path, required=True)
    parser.add_argument("--cover-youth-adult", type=Path, required=True)
    parser.add_argument("--android-assets-root", type=Path, default=ANDROID_ROOT / "app/src/main/assets")
    parser.add_argument("--skip-android-assets", action="store_true")
    parser.add_argument("--replace", action="store_true", help="Replace source edition folders for this year and quarter")
    args = parser.parse_args()
    if args.year < 1900 or args.year > 2200:
        parser.error("--year must be between 1900 and 2200")
    if not args.revision or args.revision[0] not in "abcdefghijklmnopqrstuvwxyz0123456789" or any(ch not in "abcdefghijklmnopqrstuvwxyz0123456789-" for ch in args.revision):
        parser.error("--revision must be a lowercase slug")
    try:
        import_editions(args)
    except Exception as error:
        print(f"Import failed: {error}", file=sys.stderr)
        return 1
    print(f"Imported 2 book editions for {args.year} Q{args.quarter}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
