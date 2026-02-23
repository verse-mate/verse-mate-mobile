#!/usr/bin/env python3
"""
Generate versemate-seed.db — a pre-populated SQLite database bundled with the app.

Fetches NASB1995 Bible verses, en-US commentaries, and en topics from the live
API and inserts them into a database that matches the app's offline schema exactly.

Usage:
    python3 scripts/generate-seed-db.py

Output:
    assets/data/versemate-seed.db

Re-run this script whenever the backend content is updated significantly (new
Bible version release, revised commentaries, etc.). Commit the resulting .db
file so EAS Cloud builds include it.
"""

import json
import os
import sqlite3
import sys
import urllib.request
from datetime import datetime, timezone

API_URL = "https://api.versemate.org"
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "assets", "data", "versemate-seed.db")
BATCH_SIZE = 1000


def fetch_json(url: str) -> object:
    print(f"  Fetching {url} ...", flush=True)
    with urllib.request.urlopen(url, timeout=120) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data


def create_schema(conn: sqlite3.Connection) -> None:
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS offline_verses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            version_key TEXT NOT NULL,
            book_id INTEGER NOT NULL,
            chapter_number INTEGER NOT NULL,
            verse_number INTEGER NOT NULL,
            text TEXT NOT NULL,
            UNIQUE(version_key, book_id, chapter_number, verse_number)
        );
        CREATE INDEX IF NOT EXISTS idx_verses_lookup
            ON offline_verses(version_key, book_id, chapter_number);

        CREATE TABLE IF NOT EXISTS offline_explanations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            language_code TEXT NOT NULL,
            explanation_id INTEGER NOT NULL,
            book_id INTEGER NOT NULL,
            chapter_number INTEGER NOT NULL,
            verse_start INTEGER,
            verse_end INTEGER,
            type TEXT NOT NULL,
            explanation TEXT NOT NULL,
            UNIQUE(language_code, explanation_id)
        );
        CREATE INDEX IF NOT EXISTS idx_explanations_lookup
            ON offline_explanations(language_code, book_id, chapter_number);

        CREATE TABLE IF NOT EXISTS offline_topics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            language_code TEXT NOT NULL,
            topic_id TEXT NOT NULL,
            name TEXT NOT NULL,
            content TEXT NOT NULL,
            category TEXT NOT NULL DEFAULT '',
            sort_order INTEGER,
            UNIQUE(language_code, topic_id)
        );

        CREATE TABLE IF NOT EXISTS offline_topic_references (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            topic_id TEXT NOT NULL,
            reference_content TEXT NOT NULL,
            UNIQUE(topic_id)
        );

        CREATE TABLE IF NOT EXISTS offline_topic_explanations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            language_code TEXT NOT NULL,
            topic_id TEXT NOT NULL,
            type TEXT NOT NULL,
            explanation TEXT NOT NULL,
            UNIQUE(language_code, topic_id, type)
        );
        CREATE INDEX IF NOT EXISTS idx_topic_explanations_lookup
            ON offline_topic_explanations(language_code, topic_id);

        CREATE TABLE IF NOT EXISTS offline_notes (
            note_id TEXT PRIMARY KEY,
            book_id INTEGER NOT NULL,
            chapter_number INTEGER NOT NULL,
            verse_number INTEGER,
            content TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_notes_chapter
            ON offline_notes(book_id, chapter_number);

        CREATE TABLE IF NOT EXISTS offline_highlights (
            highlight_id INTEGER PRIMARY KEY,
            book_id INTEGER NOT NULL,
            chapter_number INTEGER NOT NULL,
            start_verse INTEGER NOT NULL,
            end_verse INTEGER NOT NULL,
            color TEXT NOT NULL,
            start_char INTEGER,
            end_char INTEGER,
            updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_highlights_chapter
            ON offline_highlights(book_id, chapter_number);

        CREATE TABLE IF NOT EXISTS offline_bookmarks (
            favorite_id INTEGER PRIMARY KEY,
            book_id INTEGER NOT NULL,
            chapter_number INTEGER NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_bookmarks_chapter
            ON offline_bookmarks(book_id, chapter_number);

        CREATE TABLE IF NOT EXISTS offline_metadata (
            resource_key TEXT PRIMARY KEY,
            last_updated_at TEXT NOT NULL,
            downloaded_at TEXT NOT NULL,
            size_bytes INTEGER NOT NULL
        );
    """)
    conn.commit()


def insert_in_batches(conn: sqlite3.Connection, sql: str, rows: list, label: str) -> None:
    total = len(rows)
    for i in range(0, total, BATCH_SIZE):
        batch = rows[i : i + BATCH_SIZE]
        conn.executemany(sql, batch)
        conn.commit()
        done = min(i + BATCH_SIZE, total)
        print(f"    {label}: {done}/{total}", end="\r", flush=True)
    print(f"    {label}: {total}/{total} done         ")


def insert_verses(conn: sqlite3.Connection, version_key: str, verses: list) -> None:
    sql = """
        INSERT OR IGNORE INTO offline_verses
            (version_key, book_id, chapter_number, verse_number, text)
        VALUES (?, ?, ?, ?, ?)
    """
    rows = [
        (version_key, v["book_id"], v["chapter_number"], v["verse_number"], v["text"])
        for v in verses
    ]
    insert_in_batches(conn, sql, rows, "verses")


def insert_commentaries(conn: sqlite3.Connection, language_code: str, entries: list) -> None:
    sql = """
        INSERT OR IGNORE INTO offline_explanations
            (language_code, explanation_id, book_id, chapter_number,
             verse_start, verse_end, type, explanation)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """
    rows = [
        (
            language_code,
            e["explanation_id"],
            e["book_id"],
            e["chapter_number"],
            e.get("verse_start"),
            e.get("verse_end"),
            e["type"],
            e["explanation"],
        )
        for e in entries
    ]
    insert_in_batches(conn, sql, rows, "commentaries")


def insert_topics(
    conn: sqlite3.Connection,
    topics: list,
    references: list,
    explanations: list,
) -> None:
    topic_sql = """
        INSERT OR IGNORE INTO offline_topics
            (language_code, topic_id, name, content, category, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
    """
    topic_rows = [
        (
            t["language_code"],
            t["topic_id"],
            t["name"],
            t["content"],
            t.get("category", ""),
            t.get("sort_order"),
        )
        for t in topics
    ]
    insert_in_batches(conn, topic_sql, topic_rows, "topics")

    ref_sql = """
        INSERT OR IGNORE INTO offline_topic_references (topic_id, reference_content)
        VALUES (?, ?)
    """
    ref_rows = [(r["topic_id"], r["reference_content"]) for r in references]
    if ref_rows:
        insert_in_batches(conn, ref_sql, ref_rows, "topic references")

    exp_sql = """
        INSERT OR IGNORE INTO offline_topic_explanations
            (language_code, topic_id, type, explanation)
        VALUES (?, ?, ?, ?)
    """
    exp_rows = [
        (e["language_code"], e["topic_id"], e["type"], e["explanation"])
        for e in explanations
    ]
    if exp_rows:
        insert_in_batches(conn, exp_sql, exp_rows, "topic explanations")


def main() -> None:
    output_path = os.path.normpath(OUTPUT_PATH)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    # Remove any existing seed DB to start fresh
    if os.path.exists(output_path):
        os.remove(output_path)
        print(f"Removed existing seed DB at {output_path}")

    now_iso = datetime.now(timezone.utc).isoformat()

    print("\n[1/4] Fetching manifest...")
    manifest = fetch_json(f"{API_URL}/offline/manifest")

    # Find timestamps and sizes from manifest
    nasb_info = next(v for v in manifest["bible_versions"] if v["key"] == "NASB1995")
    en_commentary_info = next(
        c for c in manifest["commentary_languages"] if c["code"] == "en-US"
    )
    en_topics_info = next(
        t for t in manifest["topic_languages"] if t["code"] == "en"
    )

    print("\n[2/4] Fetching Bible verses (NASB1995)...")
    verses = fetch_json(f"{API_URL}/offline/bible/NASB1995")
    print(f"  -> {len(verses)} verses")

    print("\n[3/4] Fetching en-US commentaries...")
    commentaries = fetch_json(f"{API_URL}/offline/commentaries/en-US")
    print(f"  -> {len(commentaries)} entries")

    print("\n[4/4] Fetching en topics...")
    topics_data = fetch_json(f"{API_URL}/offline/topics/en")
    print(
        f"  -> {len(topics_data['topics'])} topics, "
        f"{len(topics_data['references'])} references, "
        f"{len(topics_data['explanations'])} explanations"
    )

    print(f"\nCreating seed database at:\n  {output_path}\n")
    conn = sqlite3.connect(output_path)
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA synchronous = NORMAL")

    print("Creating schema...")
    create_schema(conn)

    print("Inserting NASB1995 verses...")
    insert_verses(conn, "NASB1995", verses)

    print("Inserting en-US commentaries...")
    insert_commentaries(conn, "en-US", commentaries)

    print("Inserting en topics...")
    insert_topics(
        conn,
        topics_data["topics"],
        topics_data["references"],
        topics_data["explanations"],
    )

    # Calculate actual sizes from what we fetched
    verse_size = len(json.dumps(verses).encode())
    commentary_size = len(json.dumps(commentaries).encode())
    topics_size = len(json.dumps(topics_data).encode())

    print("Writing metadata rows...")
    conn.executemany(
        """
        INSERT OR REPLACE INTO offline_metadata
            (resource_key, last_updated_at, downloaded_at, size_bytes)
        VALUES (?, ?, ?, ?)
        """,
        [
            ("bible:NASB1995", nasb_info["updated_at"], now_iso, verse_size),
            ("commentary:en-US", en_commentary_info["updated_at"], now_iso, commentary_size),
            ("topics:en", en_topics_info["updated_at"], now_iso, topics_size),
        ],
    )
    conn.commit()

    # Compact the database
    print("Vacuuming database...")
    conn.execute("VACUUM")
    conn.close()

    file_size_mb = os.path.getsize(output_path) / 1024 / 1024
    print(f"\nDone! Seed database: {file_size_mb:.1f} MB")
    print(f"  Verses:       {len(verses):,}")
    print(f"  Commentaries: {len(commentaries):,}")
    print(f"  Topics:       {len(topics_data['topics']):,}")
    print(f"\nCommit assets/data/versemate-seed.db to include it in the app bundle.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nAborted.")
        sys.exit(1)
