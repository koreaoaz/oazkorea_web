"""Persistent notice/promotion translator. Run separately from the Next.js process."""
import argparse
import json
import os
import re
import sqlite3
import subprocess
import time

import psycopg
from public_english import (
    CATALOG, EDITORIAL_TERMS, English, HOME, KOREAN, REVIEWED_NOTICES, SOURCE_HOLDS,
    VERSION, digest, field_revision,
)

MARKER = re.compile(r"^\s*(?:\[(?:공지|홍보|이벤트|Notice|Recruitment)\]\s*)+", re.I)
DESKTOP_USER = "oaz_desktop_notice_worker"
CREDENTIAL = HOME / "notice-worker.dpapi"


def usable(original, value):
    return (isinstance(value, str) and bool(value.strip()) and "�" not in value
            and (not KOREAN.search(original) or re.search("[A-Za-z]", value) is not None))


def translate(engine, job):
    source = job["source"]
    if digest(source) != job["hash"] or SOURCE_HOLDS.get(f"editor_0_noti/{job['id']}") == job["revisionHash"]:
        raise ValueError("source hold")
    title = job["field"] == "title"
    original = MARKER.sub("", source) if title else source
    canonical = REVIEWED_NOTICES.get(str(job["id"]), {})
    if canonical and ((title and canonical["titleKo"] == source) or canonical["sourceHash"] == job["revisionHash"]):
        return canonical[job["field"]]
    if title and original in EDITORIAL_TERMS:
        return EDITORIAL_TERMS[original]
    column = "text" if title else "description"
    path = CATALOG / "editor_0_noti" / f"{job['id']}.json"
    value = None
    if path.is_file():
        try:
            saved = json.loads(path.read_text(encoding="utf8"))
        except (ValueError, OSError):
            saved = {}
        fields = saved.get("fields") if isinstance(saved, dict) else None
        entry = fields.get(column) if isinstance(fields, dict) else None
        if (isinstance(entry, dict) and saved.get("model") == VERSION and entry.get("hash") == job["hash"]
                and entry.get("revision", "") == field_revision(source, "editor_0_noti", column)):
            value = entry.get("en")
    if not usable(original, value):
        value = EDITORIAL_TERMS.get(original) or engine.field(original)
    if title:
        value = MARKER.sub("", value)
    if not usable(original, value):
        raise ValueError("incomplete English")
    if len(value) > (500 if title else 40000):
        raise ValueError("translation too long")
    return value


def process_one(conn, engine, on_published=None):
    job = conn.execute("SELECT oaz_notice_en.claim()").fetchone()[0]
    if not job:
        return False
    try:
        value = translate(engine, job)
        engine.cache.commit()
    except (ValueError, RuntimeError, OSError, ArithmeticError, sqlite3.Error) as error:
        engine.cache.rollback()
        print("Translation scheduled for retry:", type(error).__name__, flush=True)
        value = None
    accepted, = conn.execute("SELECT oaz_notice_en.finish(%s,%s,%s,%s,%s)",
                             (job["id"], job["field"], job["hash"], job["lease"], value)).fetchone()
    if accepted and value is not None and on_published:
        on_published()
    return True


def desktop_password():
    # DPAPI is bound to the current Windows account. Plaintext travels only in a pipe.
    result = subprocess.run(
        ["powershell.exe", "-NoProfile", "-NonInteractive", "-Command",
         "$ErrorActionPreference='Stop'; [Console]::Write([Net.NetworkCredential]::new('',"
         "(ConvertTo-SecureString ([Console]::In.ReadToEnd()))).Password)"],
        input=CREDENTIAL.read_bytes(), capture_output=True, check=True,
        creationflags=subprocess.CREATE_NO_WINDOW)
    return result.stdout.decode("ascii")


def run(desktop, once):
    engine = English()
    while True:
        try:
            config = (dict(host="127.0.0.1", port=55342, dbname="postgres", user=DESKTOP_USER,
                           password=desktop_password(), sslmode="disable") if desktop else
                      dict(sslmode="verify-full", service=os.environ["OAZ_TRANSLATION_PGSERVICE"]))
            with psycopg.connect(**config, autocommit=True, connect_timeout=8,
                                 application_name="oaz-notice-english") as conn:
                allowed, = conn.execute("""SELECT pg_has_role(current_user,'oaz_notice_translator','USAGE')
                    AND NOT (rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
                    FROM pg_roles WHERE rolname=current_user""").fetchone()
                if not allowed:
                    raise RuntimeError("Dedicated worker login required")
                if desktop and not conn.execute("SELECT pg_try_advisory_lock(742301981)").fetchone()[0]:
                    return
                while True:
                    worked = process_one(conn, engine)
                    if not worked:
                        if once:
                            return
                        time.sleep(3)
        except psycopg.Error as error:
            if once:
                raise RuntimeError(type(error).__name__) from None
            print("Database retry:", type(error).__name__, flush=True)
            time.sleep(15)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--desktop", action="store_true")
    parser.add_argument("--once", action="store_true", help="Drain currently available work and exit")
    args = parser.parse_args()
    run(args.desktop, args.once)
