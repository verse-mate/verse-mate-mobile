#!/usr/bin/env python3
"""
Generate assets/data/jesus-seed.db — the Jesus feature, bundled for offline use.

The English Bible and commentaries already ship inside the app (see
generate-seed-db.py); the Jesus feature had nothing, so on a slow or absent
connection every Jesus page sat on a spinner (Andy, on a plane, 2026-09-28:
"Same deal on Jesus feature. Lots of not loading.").

There is no bulk /offline/jesus endpoint, so this walks the SAME endpoints the
app calls and records each response under the key the app will look it up by
(services/offline/jesus-store.ts, `jesusCacheKey`): the path plus its query
string, sorted, WITHOUT bible_version — scripture is re-rendered on the device
in the reader's own version from the offline Bible, so the bundle is
version-neutral apart from the NASB1995 text it carries as a fallback.

The app's keys also start with the content language (`en:/jesus/...`). The
bundle stores them without it and records its language in jesus_meta;
`importJesusSeed` adds the prefix on import, so the language is decided in one
place. Fetch it anonymously: a signed-in request would come back in that
user's preferred language, not English.

Usage:
    python3 scripts/generate-jesus-bundle.py

Re-run when the Jesus content changes; the app imports a bundle whose
`generated_at` is newer than the one it holds, so an app update carrying a new
bundle refreshes existing installs too.
"""

import json
import os
import sys
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

API_URL = os.environ.get("API_URL", "https://api.versemate.org")
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "data", "jesus-seed.db")
# What the device renders by default. Without it the server OMITS scripture from
# an event entirely — the first run of this script bundled 516 events with no
# passages. The app always sends a version; so must this.
BIBLE_VERSION = "NASB1995"

# The four Gospels — the chapters the reader can ask "what did Jesus do here?" of.
GOSPELS = {40: 28, 41: 16, 42: 24, 43: 21}


def key(path: str, query: dict | None = None) -> str:
    q = {k: str(v) for k, v in (query or {}).items() if v not in (None, "") and k != "bible_version"}
    qs = urllib.parse.urlencode(sorted(q.items()))
    return f"{path}?{qs}" if qs else path


def fetch(path: str, query: dict | None = None):
    url = f"{API_URL}{path}?" + urllib.parse.urlencode({**(query or {}), "bible_version": BIBLE_VERSION})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:  # noqa: BLE001 — retried, then reported
            last = e
    raise RuntimeError(f"{url}: {last}")


def main() -> int:
    out: dict[str, object] = {}

    def put(path, query=None):
        out[key(path, query)] = fetch(path, query)
        return out[key(path, query)]

    overview = put("/jesus/events/overview")
    put("/jesus/overview")
    life = put("/jesus/events/life")
    themes = put("/jesus/themes")
    # The API caps `limit` at 200, so page until `total` — a silent cap is how the
    # first run of this script bundled 200 of 231 entries and looked complete.
    first = fetch("/jesus/entries", {"limit": 200, "offset": 0})
    all_entries = list(first.get("entries", []))
    while len(all_entries) < first.get("total", 0):
        page = fetch("/jesus/entries", {"limit": 200, "offset": len(all_entries)})
        if not page.get("entries"):
            break
        all_entries.extend(page["entries"])
    if len(all_entries) != first.get("total"):
        raise RuntimeError(f"entries: got {len(all_entries)} of {first.get('total')}")
    entries = {"entries": all_entries, "total": len(all_entries), "limit": len(all_entries), "offset": 0}
    # Stored under a key of its own: the device searches it locally (see
    # jesus-offline.ts) rather than looking it up by a request's query string.
    out["local:entries"] = entries

    types = sorted({t["slug"] for s in overview.get("sections", []) for t in s.get("types", [])})
    collections = [c["slug"] for c in overview.get("collections", [])]
    theme_slugs = [t["slug"] for t in themes.get("themes", [])]

    slugs: set[str] = {e["slug"] for p in life.get("periods", []) for e in p.get("events", [])}
    jobs = []
    for t in types:
        jobs.append(("/jesus/events/browse/" + urllib.parse.quote(t), None))
    for c in collections:
        jobs.append(("/jesus/events/collections/" + urllib.parse.quote(c), None))
    for th in theme_slugs:
        # One full page per theme; the device slices it for the screen's paging.
        # 200 is the API's cap — asserted below, so a theme outgrowing it fails
        # loudly instead of bundling a truncated list.
        jobs.append(("/jesus/events", {"theme": th, "limit": 200, "offset": 0}))
    for book, n in GOSPELS.items():
        for ch in range(1, n + 1):
            jobs.append(("/jesus/for-passage", {"book_id": book, "chapter": ch}))

    with ThreadPoolExecutor(8) as pool:
        for (path, query), data in zip(jobs, pool.map(lambda j: fetch(*j), jobs)):
            out[key(path, query)] = data
            if path.startswith("/jesus/events/browse/"):
                for topic in data.get("topics", []):
                    slugs.update(e["slug"] for e in topic.get("events", []))
            if path.startswith("/jesus/events/collections/") or path == "/jesus/events":
                slugs.update(e["slug"] for e in data.get("events", []))
            if path == "/jesus/events" and len(data.get("events", [])) < data.get("total", 0):
                raise RuntimeError(f"{path} {query}: {len(data['events'])} of {data['total']}")

    # Facet slugs resolve to events too, and search results open them that way,
    # so every entry's slug must answer offline — store the event it opens under
    # the entry's own key as well.
    entry_slugs = [e["slug"] for e in entries.get("entries", [])]

    detail_jobs = sorted(slugs | set(entry_slugs))
    with ThreadPoolExecutor(8) as pool:
        details = list(pool.map(lambda s: fetch("/jesus/events/" + urllib.parse.quote(s)), detail_jobs))
    for s, d in zip(detail_jobs, details):
        out[key("/jesus/events/" + urllib.parse.quote(s))] = d
    with ThreadPoolExecutor(8) as pool:
        compares = list(pool.map(lambda s: fetch(f"/jesus/events/{urllib.parse.quote(s)}/compare"), sorted(slugs)))
    for s, d in zip(sorted(slugs), compares):
        out[key(f"/jesus/events/{urllib.parse.quote(s)}/compare")] = d

    # Sanity: an event that carries passages must carry their verses.
    empty = [k for k, v in out.items() if isinstance(v, dict) and "event" in v
             and v.get("passages") and not any(p.get("verses") for p in v["passages"])]
    if empty:
        raise RuntimeError(f"{len(empty)} events bundled without scripture, e.g. {empty[:3]}")

    # SQLite rather than JSON: the app ATTACHes this file and copies the rows in
    # with one INSERT … SELECT, instead of parsing megabytes of JSON on the JS
    # thread (or inlining it into the JS bundle, which a .json require would).
    import sqlite3
    if os.path.exists(OUT):
        os.remove(OUT)
    db = sqlite3.connect(OUT)
    db.executescript("""
        CREATE TABLE offline_jesus (
            key TEXT PRIMARY KEY,
            payload TEXT NOT NULL,
            bible_version TEXT,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE jesus_meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
    """)
    # Milliseconds + Z: microsecond `+00:00` stamps are outside the ECMAScript
    # date-time format, so `Date.parse` on the device is engine-specific.
    generated_at = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    db.executemany(
        "INSERT INTO offline_jesus (key, payload, bible_version, updated_at) VALUES (?, ?, ?, ?)",
        [(k, json.dumps(v, ensure_ascii=False, separators=(",", ":")),
          None if k.startswith("local:") else BIBLE_VERSION, generated_at) for k, v in out.items()],
    )
    db.executemany("INSERT INTO jesus_meta VALUES (?, ?)", [
        ("generated_at", generated_at), ("language", "en"), ("bible_version", BIBLE_VERSION),
        ("responses", str(len(out))),
    ])
    db.commit()
    db.execute("VACUUM")
    db.close()
    size = os.path.getsize(OUT)
    print(f"{len(out)} responses ({len(slugs)} events, {len(entry_slugs)} entries) -> {OUT} ({size/1e6:.1f} MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
