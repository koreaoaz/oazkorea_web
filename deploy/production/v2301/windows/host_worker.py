"""Windows service child. Only an installed, explicitly enabled host can contact Main."""
import argparse
from datetime import datetime, timezone
import json
import msvcrt
import os
from pathlib import Path
import re
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
STATE = ROOT / "state"
CONFIG = ROOT / "config"
MAIN = "maoefmwpdcnugyenyiea"
ROLE = "oaz_notice_worker"
os.environ["OAZ_TRANSLATION_HOME"] = str(STATE)
for key in list(os.environ):
    if key.startswith("PG"):
        del os.environ[key]
sys.path.insert(0, str(ROOT / "scripts"))
import psycopg
from notice_english_worker import English, process_one


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class Status:
    def __init__(self):
        self.path = STATE / "status.json"
        self.last = None
        if self.path.exists():
            self.last = json.loads(self.path.read_text("utf8")).get("lastPublishedUtc")
        self.updated = 0
        self.phase = None

    def record(self, phase, published=False):
        if published:
            self.last = now()
        if phase == self.phase and not published and time.monotonic() - self.updated < 20:
            return
        data = dict(phase=phase, pid=os.getpid(), heartbeatUtc=now(), lastPublishedUtc=self.last)
        temp = self.path.with_suffix(".tmp")
        temp.write_text(json.dumps(data), encoding="utf8")
        temp.replace(self.path)
        self.phase, self.updated = phase, time.monotonic()


def password():
    # No secret in argv, stdout of the parent, environment or status.
    shell = Path(os.environ["SystemRoot"]) / "System32/WindowsPowerShell/v1.0/powershell.exe"
    command = """$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security;
    $b=[Convert]::FromBase64String([Console]::In.ReadToEnd());
    $v=[Security.Cryptography.ProtectedData]::Unprotect($b,$null,'LocalMachine');
    $o=[Console]::OpenStandardOutput(); $o.Write($v,0,$v.Length); [Array]::Clear($v,0,$v.Length)"""
    result = subprocess.run([shell, "-NoProfile", "-NonInteractive", "-Command", command],
                            input=(CONFIG / "password.dpapi").read_bytes(), capture_output=True,
                            check=True, creationflags=subprocess.CREATE_NO_WINDOW, timeout=20)
    return result.stdout.decode("utf8")


def settings(qa):
    if qa:
        if not re.fullmatch("oaz_notice_qa_[0-9a-f]{32}", qa):
            raise ValueError("Invalid isolated database")
        return dict(host="127.0.0.1", port=55342, dbname=qa, user=qa, sslmode="disable")
    if ROOT != Path(os.environ["ProgramFiles"]) / "OAZNoticeEnglish":
        raise ValueError("Unexpected installation path")
    if (CONFIG / "enabled").read_text("ascii").strip() != MAIN:
        raise ValueError("Unexpected project")
    cert = CONFIG / "root.crt"
    if not cert.is_file():
        raise ValueError("Missing project CA")
    # Existing Main session pooler; port 5432 preserves session-level advisory locks.
    return dict(host="aws-0-ap-northeast-1.pooler.supabase.com", port=5432, dbname="postgres", user=f"{ROLE}.{MAIN}",
                sslmode="verify-full", sslrootcert=str(cert), gssencmode="disable")


def run(qa):
    with (STATE / "singleton.lock").open("a+b") as lock:
        try:
            msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
        except OSError:
            return 3
        status = Status()
        while not qa and not (CONFIG / "enabled").exists():
            status.record("standby")
            time.sleep(3)
        config = settings(qa)
        engine = None
        while True:
            try:
                with psycopg.connect(**config, password=password(), connect_timeout=8, autocommit=True,
                                     application_name="oaz-windows-notice",
                                     keepalives=1, keepalives_idle=30, keepalives_interval=10,
                                     keepalives_count=3) as conn:
                    ok, = conn.execute("""
                        SELECT current_database()=%s AND current_user=%s
                           AND pg_has_role(current_user,'oaz_notice_translator','USAGE')
                           AND NOT (rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
                           AND NOT EXISTS (SELECT FROM pg_auth_members m WHERE m.member=r.oid
                               AND (m.roleid <> 'oaz_notice_translator'::regrole OR m.admin_option))
                        FROM pg_roles r WHERE rolname=current_user
                    """, (config["dbname"], qa or ROLE)).fetchone()
                    if not ok:
                        status.record("role-rejected")
                        return 2
                    if not conn.execute("SELECT pg_try_advisory_lock(742301981)").fetchone()[0]:
                        status.record("waiting-for-worker")
                        time.sleep(15)
                        continue
                    if engine is None:
                        status.record("loading-model")
                        engine = English(ROOT / "opus")
                    while True:
                        status.record("connected")
                        if not process_one(conn, engine, lambda: status.record("connected", True)):
                            time.sleep(3)
            except psycopg.Error as error:
                status.record("db-retry-" + type(error).__name__)
                time.sleep(15)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--qa-db")
    args = parser.parse_args()
    sys.exit(run(args.qa_db))
