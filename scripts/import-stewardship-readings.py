#!/usr/bin/env python3
"""Import the 2026 tithe and offering readings into the book catalog and app.

The user-supplied SQLite database is read-only. The import produces one annual
book edition with 52 date-indexed Sabbath readings, plus an integrity-checked
asset bundle so the complete book is available without a network connection.
"""

from __future__ import annotations

import argparse
import hashlib
import html
from html.parser import HTMLParser
import json
from pathlib import Path
import shutil
import sqlite3
import sys
from datetime import date, timedelta


ROOT = Path(__file__).resolve().parent.parent
ANDROID_ROOT = ROOT.parent / "sabatku-android"
LANDING_URL = "https://stewardship.adventist.org/2026%E2%80%94for-local-churches-and-divisions-translators"
PDF_URL = "https://stewardship.adventist.org/2026-the-joyful-art-of-systematic-giving.pdf"
WORK_ID = "work:stewardship-readings"
EDITION_ID = "edition:stewardship-readings:2026:id"
EDITION_KEY = "stewardship-readings-2026-id"
REVISION = "4"
MONTHS_ID = ("Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember")
WEEKDAYS_ID = ("Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu")


class ParagraphExtractor(HTMLParser):
    """Convert passive paragraphs from the SQLite content into safe Markdown."""

    allowed = {"p", "br", "em", "i", "strong", "b"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.paragraphs: list[str] = []
        self.current: list[str] = []
        self.inline_stack: list[tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        if tag not in self.allowed or attrs:
            raise ValueError(f"Unsupported or unsafe HTML element: <{tag}>")
        if tag == "p":
            self._finish_paragraph()
        elif tag == "br":
            self.current.append(" ")
        elif tag in {"em", "i"}:
            self.current.append("*")
            self.inline_stack.append((tag, "*"))
        elif tag in {"strong", "b"}:
            self.current.append("**")
            self.inline_stack.append((tag, "**"))

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in {"em", "i", "strong", "b"}:
            if not self.inline_stack or self.inline_stack[-1][0] != tag:
                raise ValueError(f"Mismatched inline HTML closing tag: </{tag}>")
            _, marker = self.inline_stack.pop()
            self.current.append(marker)
        elif tag == "p":
            self._finish_paragraph()
        elif tag not in self.allowed:
            raise ValueError(f"Unsupported or unsafe HTML closing tag: </{tag}>")

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


def parse_body(value: str, row_id: str) -> str:
    parser = ParagraphExtractor()
    try:
        parser.feed(value)
        parser.close()
    except Exception as error:
        raise ValueError(f"{row_id}: invalid reading HTML: {error}") from error
    body = parser.result()
    if not body or "\x00" in body:
        raise ValueError(f"{row_id}: reading body is empty or invalid")
    return body


def sabbath_label(day: date) -> str:
    return f"{WEEKDAYS_ID[day.weekday()]}, {day.day} {MONTHS_ID[day.month - 1]} {day.year}"


def read_readings(database: Path, year: int) -> list[dict[str, object]]:
    if not database.is_file():
        raise ValueError(f"SQLite database not found: {database}")
    connection = sqlite3.connect(database.resolve().as_uri() + "?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    try:
        tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if "offerings" not in tables:
            raise ValueError("The SQLite database does not contain the offerings table.")
        columns = {row[1] for row in connection.execute("PRAGMA table_info(offerings)")}
        required = {"id", "sabbath_date", "title", "book_title", "verse_text", "body_html", "year", "quarter", "language_code"}
        if not required.issubset(columns):
            raise ValueError(f"The offerings table is missing columns: {sorted(required - columns)}")
        rows = connection.execute(
            """SELECT id, sabbath_date, title, book_title, verse_text, body_html,
                      year, quarter, language_code
                 FROM offerings WHERE year=? ORDER BY sabbath_date""",
            (year,),
        ).fetchall()
    finally:
        connection.close()

    first_day = date(year, 1, 1)
    expected_count = sum(
        (first_day + timedelta(days=offset)).weekday() == 5
        for offset in range((date(year + 1, 1, 1) - first_day).days)
    )
    if len(rows) != expected_count:
        raise ValueError(f"Expected {expected_count} weekly readings for {year}; found {len(rows)}.")
    result: list[dict[str, object]] = []
    seen_dates: set[str] = set()
    book_titles: set[str] = set()
    for order, row in enumerate(rows, start=1):
        if row["language_code"].lower() != "id":
            raise ValueError(f"{row['id']}: expected Indonesian content, found {row['language_code']}.")
        if int(row["year"]) != year:
            raise ValueError(f"{row['id']}: row year does not match the requested edition.")
        reading_date = date.fromisoformat(row["sabbath_date"].strip())
        if reading_date.year != year or reading_date.weekday() != 5 or (reading_date.month - 1) // 3 + 1 != int(row["quarter"]):
            raise ValueError(f"{row['id']}: reading date must be a Saturday in its declared year and quarter.")
        if reading_date.isoformat() in seen_dates:
            raise ValueError(f"Duplicate Sabbath reading date: {reading_date.isoformat()}")
        seen_dates.add(reading_date.isoformat())
        title = " ".join(html.unescape(row["title"]).split())
        book_title = " ".join(html.unescape(row["book_title"]).split())
        if not title or not book_title:
            raise ValueError(f"{row['id']}: every reading needs a title and book title.")
        book_titles.add(book_title)
        body = parse_body(row["body_html"], row["id"])
        verse = " ".join((row["verse_text"] or "").split())
        markdown = f"> **{sabbath_label(reading_date)}**\n\n"
        if verse:
            markdown += f"> *{verse}*\n\n"
        markdown += body + "\n"
        result.append({
            "id": f"reading-{reading_date.isoformat()}",
            "date": reading_date.isoformat(),
            "title": title,
            "book_title": book_title,
            "order": order,
            "body": markdown,
        })

    if len(book_titles) != 1:
        raise ValueError(f"Expected one annual book title; found {sorted(book_titles)}")
    if len(result) != len(seen_dates):
        raise ValueError("The annual readings contain a duplicate or missing date.")
    return result


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def write_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def import_readings(database: Path, cover: Path, year: int) -> int:
    if not cover.is_file() or not cover.read_bytes().startswith(b"\xff\xd8\xff"):
        raise ValueError(f"Cover must be a valid JPEG image: {cover}")
    readings = read_readings(database, year)
    title_theme = readings[0]["book_title"]

    content_root = ROOT / "content/id/stewardship-readings"
    work = {
        "kind": "work",
        "id": WORK_ID,
        "key": "stewardship-readings",
        "title": "Bacaan Persembahan dan Persepuluhan",
        "author": "Julian Archer",
        "seriesIds": ["joyful-art-systematic-giving"],
    }
    edition = {
        "kind": "edition",
        "id": EDITION_ID,
        "key": EDITION_KEY,
        "workId": WORK_ID,
        "locale": "id",
        "title": f"Bacaan Persembahan dan Persepuluhan {year}",
        "description": f"Edisi {year} berisi {len(readings)} bacaan mingguan untuk setiap Sabat. Tema edisi: {title_theme}. Isi lengkap dan cover tersedia offline.",
        "revision": REVISION,
        "status": "published",
        "rights": {
            "status": "verified",
            "attribution": "Stewardship Ministries of the Seventh-day Adventist Church; edisi Bahasa Indonesia SabatKu.",
            "offlineAllowed": True,
            "permissionNote": "Booklet resmi 2026 mengizinkan entitas Gereja Masehi Advent Hari Ketujuh menerjemahkan, mencetak, atau menggandakannya dengan mencantumkan atribusi Stewardship Ministries.",
        },
        "primaryThemeId": "spiritual-growth:personal-stewardship",
        "themeIds": ["spiritual-growth:personal-stewardship", "prayer-worship:church-worship"],
        "collectionIds": ["tithe-offering-readings"],
        "audienceIds": ["all"],
        "sources": [
            {
                "kind": "provider-page",
                "label": "2026 Tithe & Offerings Devotional Readings — Adventist Stewardship Ministries",
                "url": LANDING_URL,
                "primary": True,
                "offlineAllowed": False,
            },
            {
                "kind": "pdf",
                "label": "Booklet resmi 2026 — The Joyful Art of Systematic Giving (PDF)",
                "url": PDF_URL,
                "primary": False,
                "offlineAllowed": False,
            },
        ],
        "cover": "assets/cover.jpg",
        "nodes": [],
    }

    chapters: list[dict[str, object]] = []
    for reading in readings:
        chapter_id = str(reading["id"])
        node_file = f"nodes/{chapter_id}.md"
        markdown = str(reading["body"])
        (content_root / str(year) / node_file).parent.mkdir(parents=True, exist_ok=True)
        # Keep the bytes used for the manifest digest identical on Windows and
        # Unix. Path.write_text() translates LF to CRLF on Windows.
        (content_root / str(year) / node_file).write_bytes(markdown.encode("utf-8"))
        chapters.append({
            "id": chapter_id,
            "title": str(reading["title"]),
            "nodeType": "chapter",
            "order": int(reading["order"]),
            "readingDate": str(reading["date"]),
            "file": node_file,
        })
        raw = markdown.encode("utf-8")
        chapters[-1]["bytes"] = len(raw)
        chapters[-1]["sha256"] = digest(raw)
        chapters[-1]["contentAssetPath"] = f"stewardship-readings/{year}/{chapter_id}.md"
        edition["nodes"].append({key: value for key, value in chapters[-1].items() if key not in {"bytes", "sha256", "contentAssetPath"}})

    write_json(content_root / "works/readings.json", work)
    write_json(content_root / str(year) / "edition.json", edition)
    assets_root = ANDROID_ROOT / "app/src/main/assets/stewardship-readings"
    assets_root.mkdir(parents=True, exist_ok=True)
    (assets_root / str(year)).mkdir(parents=True, exist_ok=True)
    for chapter in chapters:
        chapter_id = str(chapter["id"])
        shutil.copyfile(content_root / str(year) / "nodes" / f"{chapter_id}.md", assets_root / f"{year}/{chapter_id}.md")
    (content_root / str(year) / "assets").mkdir(parents=True, exist_ok=True)
    shutil.copyfile(cover, content_root / str(year) / "assets/cover.jpg")
    shutil.copyfile(cover, assets_root / "cover.jpg")
    bundle = {
        "schemaVersion": 1,
        "book": {
            "id": EDITION_ID,
            "workId": WORK_ID,
            "title": edition["title"],
            "description": edition["description"],
            "locale": "id",
            "revision": REVISION,
            "author": work["author"],
            "attribution": edition["rights"]["attribution"],
            "coverAssetPath": "stewardship-readings/cover.jpg",
            "offlineAllowed": True,
            "rightsStatus": "verified",
            "primaryThemeId": edition["primaryThemeId"],
            "themeIds": edition["themeIds"],
            "collectionIds": edition["collectionIds"],
            "audienceIds": edition["audienceIds"],
            "seriesIds": work["seriesIds"],
            "sources": edition["sources"],
        },
        "readings": chapters,
    }
    write_json(assets_root / "index.json", bundle)
    return len(readings)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", type=Path, required=True, help="User-supplied Indonesian SQLite database")
    parser.add_argument("--cover", type=Path, required=True, help="JPEG cover for the annual booklet")
    parser.add_argument("--year", type=int, default=2026)
    args = parser.parse_args()
    try:
        if args.year != 2026:
            raise ValueError("This importer is pinned to the official 2026 booklet; a later year needs its own source and rights metadata.")
        total = import_readings(args.database, args.cover, args.year)
        print(f"Imported {total} Sabbath readings for {args.year} into sabatku-books and Android offline assets.")
        return 0
    except Exception as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
