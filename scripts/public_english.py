"""Generate English from the anonymous 3310 public projections. No DB credentials."""
import argparse
from decimal import Decimal
import hashlib
import json
import os
import re
import sqlite3
import time
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import ProxyHandler, HTTPRedirectHandler, build_opener

HOME = Path(os.environ.get("OAZ_TRANSLATION_HOME") or (Path(os.environ.get("LOCALAPPDATA", Path.home())) / "OAZ-Translation"))
VERSION = "opus-ko-en-0703446-v3"
CATALOG = HOME / "published" / VERSION
SOURCE_HOLDS = json.loads(
    (Path(__file__).resolve().parents[1] / "src/lib/public-translation-holds.json").read_text(encoding="utf-8")
)
ORIGIN = "http://127.0.0.1:3310/api/public/"
REVIEWED_NOTICES = json.loads((Path(__file__).resolve().parents[1] / "src/data/reviewed-notice-english.json").read_text(encoding="utf-8"))
TABLES = {
    "oaz_notice_feed": ("text", "description"),
    "editor_1_projects": ("project_name", "detailed_description", "description", "duration", "achievements"),
    "editor_2_studies": ("study_name", "outline"),
    "editor_4_schedules": ("description",),
    "editor_6_events": ("title", "description"),
    "editor_3_study_timetable": ("study_name",),
}
GLOSSARY = {"고려대학교": "Korea University", "하나와영": "OaZ", "학회원": "society members",
            "명예의 전당": "Hall of Fame", "전기전자공학부": "School of Electrical Engineering"}
TECH = {"유니티": "Unity", "파이썬": "Python", "자바스크립트": "JavaScript", "리액트": "React", "깃허브": "GitHub"}
TECH.update({value: value for value in tuple(TECH.values())})
TECH_WORD = re.compile("|".join(re.escape(term) if not term.isascii() else r"(?<![a-zA-Z])" + term + r"(?![a-zA-Z])" for term in TECH), re.I)
CANONICAL = {key.casefold(): value for key, value in TECH.items()}
GLOSSARY.update(TECH)

EDITORIAL_TERMS = {"수희등":"Suhuideung", "유니티 기초 스터디원 모집":"Unity Basics Study Group Recruitment", "파이썬 기초 스터디원 모집":"Python Basics Study Group Recruitment"}

EDITORIAL_TERMS.update({
    "VLSI & EDA 스터디원 모집": "Join the VLSI & EDA Study Group",
    "대학생 서포터즈 컴투스 플레이어 16기 모집 (~8/18(화))": "Com2uS Player Student Supporters: Applications for the 16th Cohort (Through August 18)",
    "2026 상반기 인바디 GBD 채용 (~6/29(월))": "InBody GBD Recruitment for the First Half of 2026 (Through June 29)",
    "SK쉴더스 루키즈 지능형 애플리케이션 개발자 양성과정 6기 모집 (~5/10)": "SK Shieldus Rookies: Intelligent Application Developer Training, Cohort 6 (Through May 10)"
})

REVIEWED_LINES = {
    "<2026 상반기 인바디 GBD 채용>": "InBody GBD Recruitment for the First Half of 2026",
    "[모집기간] : ~ 26. 06. 29 (월) 13시": "Application deadline: Monday, June 29, 2026 at 13:00.",
    "[지원방법] : InBody 채용 홈페이지를 통한 온라인 접수": "How to apply: Apply online through the InBody careers website.",
    "[입사시기] : 26년 07월 27일 예정": "Expected start date: July 27, 2026.",
    "[모집부문] : GBD, 품질(신뢰성), 전자개발, SW개발, 제품디자인, Wellness CS": "Openings: GBD, quality (reliability), electronics development, software development, product design and Wellness CS.",
    "- 일시 : 26. 06. 24 (수) 오후 3시": "- Online information session: Wednesday, June 24, 2026 at 15:00."
}

def field_revision(source, table, field):
    if table == "editor_0_noti" and field == "description" and any(line in REVIEWED_LINES for line in source.splitlines()):
        return "editorial-lines-v1"
    if re.sub(r"^\[(?:공지|홍보)\]\s*", "",source) in EDITORIAL_TERMS:
        return "term-v2"
    if table == "editor_0_noti" and field == "text":
        return "heading-v2"
    return "tech-v1" if TECH_WORD.search(source) else ""

KOREAN = re.compile(r"[가-힣ㄱ-ㅎㅏ-ㅣ]")
# Split before inference so numbers, paths, code and layout are never reconstructed by the model.
PROTECTED = re.compile(
    r"(\x60\x60\x60[\s\S]*?(?:\x60\x60\x60|\Z)|\x60[^\x60\n]*\x60|https?://[^\s<>]+|/about/notice/\d+|"
    r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|[\w.-]+\.(?:pdf|docx?|xlsx?|hwp[x]?|zip|png|jpe?g|py|js)\b|"
    r"[A-Za-z][A-Za-z0-9]*[²³][≈=]?[\d.]*|\d+(?:[,./:~–-]\d+)*|^\s*[-*•▶▪]+\s*|\r\n|\n|\t| {2,}|"
    + "|".join(map(re.escape, GLOSSARY)) + ")", re.M | re.I
)


# Korean currency and count units need semantic expansion before protecting digits:
# e.g. 10만원 = 100,000 won; splitting at "10" would translate 만원 separately.
LARGE_UNIT = re.compile(r"(?<![\d.,])([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)\s*(만|억)\s*(원|개)?(?![가-힣])")
def english_quantity(match):
    count = Decimal(match[1].replace(",", "")) * (10000 if match[2]=="만" else 100000000)
    amount = format(count, ",f")
    if "." in amount:
        amount = amount.rstrip("0").rstrip(".")
    return amount + ({"원":" won", "개":" items"}.get(match[3], ""))

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args):
        raise ValueError("Unexpected redirect from local public reader")


reader = build_opener(ProxyHandler({}), NoRedirect())


def get(path, **params):
    with reader.open(ORIGIN + path + "?" + urlencode(params), timeout=40) as response:
        return json.load(response)


def digest(text):
    return hashlib.sha256(text.encode()).hexdigest()


class English:
    def __init__(self, model_dir=None):
        import ctranslate2
        import sentencepiece as sp
        model = model_dir or HOME / "opus"
        self.engine = ctranslate2.Translator(str(model), device="cpu", compute_type="int8", intra_threads=4)
        self.source = sp.SentencePieceProcessor(model_file=str(model / "source.spm"))
        self.target = sp.SentencePieceProcessor(model_file=str(model / "target.spm"))
        self.cache = sqlite3.connect(HOME / "english-cache.sqlite3", timeout=30)
        self.cache.execute("CREATE TABLE IF NOT EXISTS segments (key TEXT PRIMARY KEY, english TEXT NOT NULL)")
        self.generated = 0

    def phrase(self, text):
        key = digest(VERSION + ("-tech-v1" if TECH_WORD.search(text) else "") + "\0" + text)
        hit = self.cache.execute("SELECT english FROM segments WHERE key=?", (key,)).fetchone()
        if hit:
            return hit[0]
        # Long paragraphs are split at sentence/word boundaries before tokenization.
        pieces = self.source.encode(text, out_type=str)
        if len(pieces) > 220:
            middle = len(text) // 2
            boundary = text.rfind(" ", middle // 2, middle + 1)
            boundary = boundary if boundary > 0 else middle
            result = self.phrase(text[:boundary].strip()) + " " + self.phrase(text[boundary:].strip())
        else:
            output = self.engine.translate_batch([pieces + ["</s>"]], beam_size=3, max_decoding_length=480)[0]
            result = self.target.decode(output.hypotheses[0]).strip()
            if not result or len(output.hypotheses[0]) >= 480:
                raise ValueError("Incomplete translation")
        self.cache.execute("INSERT OR IGNORE INTO segments VALUES (?,?)", (key, result))
        self.generated += 1
        return result

    def line(self, text):
        if text in REVIEWED_LINES:
            return REVIEWED_LINES[text]
        if not KOREAN.search(text):
            return text
        text = TECH_WORD.sub(lambda m: CANONICAL[m[0].casefold()], text)
        text = LARGE_UNIT.sub(english_quantity, text)
        tokens = PROTECTED.split(text)
        protected = [GLOSSARY.get(token, token) for token in tokens[1::2]]
        # Try an intact sentence first. Keep it only when literal tokens survive in order.
        sentence = "".join((" " + GLOSSARY[t] + " ") if i % 2 and t in GLOSSARY else t
                           for i, t in enumerate(tokens)).strip()
        candidate = self.phrase(sentence)
        end = 0
        for token in protected:
            index = candidate.find(token, end)
            if index < 0:
                break
            end = index + len(token)
        else:
            if re.findall(r"\d+", candidate) == re.findall(r"\d+", text):
                return text[:len(text)-len(text.lstrip())] + candidate + text[len(text.rstrip()):]
        # A model can drop URLs/numbers. In that case splice the exact literals back.
        result = ""
        for i, part in enumerate(tokens):
            if i % 2:
                chunk = GLOSSARY.get(part, part)
            elif KOREAN.search(part):
                chunk = part[:len(part)-len(part.lstrip())] + self.phrase(part.strip()) + part[len(part.rstrip()):]
            else:
                chunk = part
            if result and chunk and result[-1].isascii() and result[-1].isalnum() and chunk[0].isascii() and chunk[0].isalnum():
                result += " "
            result += chunk
        return result

    def field(self, source):
        # Code blocks, indentation, lists, paragraphs and line endings retain exact boundaries.
        parts = re.split(r"(\x60\x60\x60[\s\S]*?(?:\x60\x60\x60|\Z)|\x60[^\x60\n]*\x60|\r\n|\n|\t| {2,})", source)
        return "".join(part if i % 2 else self.line(part) for i, part in enumerate(parts))

    def record(self, table, rid, fields, meta=None):
        path = CATALOG / table / f"{rid}.json"
        old = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
        translations = {}
        for field, source in fields.items():
            if not isinstance(source, str):
                continue
            key = digest(source)
            saved = old.get("fields", {}).get(field, {})
            notice = REVIEWED_NOTICES.get(str(rid)) if table == "editor_0_noti" else None
            if notice and ((field == "text" and source == notice["titleKo"]) or
                           (field == "description" and (meta or {}).get("sourceHash") == notice["sourceHash"])):
                translations[field] = {"hash": key, "en": notice["title" if field == "text" else "body"], "revision": "editorial-v1"}
                continue
            revision = field_revision(source, table, field)
            if saved.get("hash") == key and saved.get("revision", "") == revision:
                translations[field] = saved
                continue
            english = None
            if field == "achievements" and source.lstrip().startswith("["):
                try:
                    values = json.loads(source)
                    if isinstance(values, list) and all(isinstance(item,str) for item in values):
                        english = json.dumps([self.field(item) for item in values], ensure_ascii=False)
                except ValueError:
                    pass
            if table == "editor_0_noti" and field == "text":
                clean = re.sub(r"^\s*(?:\[(?:공지|홍보|이벤트)\]\s*)+", "", source)
                english = EDITORIAL_TERMS.get(clean) or self.field(clean)
            translations[field] = {"hash": key, "en": EDITORIAL_TERMS.get(source) or (english if english is not None else self.field(source))}
            if revision:
                translations[field]["revision"] = revision
        data = {"model": VERSION, "locale": "en", "sourceHash": (meta or {}).get("sourceHash"), "fields": translations}
        if data != old:
            path.parent.mkdir(parents=True, exist_ok=True)
            temp = path.with_suffix(f".{os.getpid()}.tmp")
            temp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
            temp.replace(path)
        self.cache.commit()

    def refresh(self):
        for table, columns in TABLES.items():
            rpc_table = "editor_0_noti" if table == "oaz_notice_feed" else table
            offset = count = 0
            while True:
                rows = get("data/" + table, select="id," + ",".join(columns), order="id.asc", limit=200, offset=offset)
                for row in rows:
                    meta = None
                    if table != "editor_3_study_timetable":
                        meta = get("content", kind="oaz_public_content_meta_v1", table=rpc_table, id=row["id"])
                        if not isinstance(meta, dict) or not meta.get("sourceHash") or meta.get("noticeEnglish") or meta.get("translationStatus") == "reviewed":
                            continue
                        # Tie visibility/metadata to the same source revision as the anonymous row.
                        text = json.dumps({"body": row[columns[min(1, len(columns)-1)]], "title": row[columns[0]]}, ensure_ascii=False)
                        if digest(text) != meta["sourceHash"]:
                            continue
                        if SOURCE_HOLDS.get(f"{rpc_table}/{row['id']}") == meta["sourceHash"]:
                            self.record(rpc_table, row["id"], {}, meta)
                            continue
                    self.record(rpc_table, row["id"], {c: row[c] for c in columns}, meta)
                    count += 1
                if len(rows) < 200:
                    break
                offset += len(rows)
            print(f"{table}: {count} public records", flush=True)
        about = get("about").get("content")
        if isinstance(about, dict):
            self.record("about", 1, {k: about[k] for k in ("name","lead","greeting","belief","founded","direction","activities","support") if k in about})
        print(f"New segments this run: {self.generated}", flush=True)
        self.generated = 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--watch", action="store_true", help="Scan public revisions every two minutes")
    args = parser.parse_args()
    if args.watch:
        # The desktop launcher can be called more than once. Windows releases the lock at process exit.
        import msvcrt
        lock = (HOME / "desktop-worker.lock").open("a+b")
        lock.seek(0)
        try:
            msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
        except OSError:
            raise SystemExit(0)
    translator = English()
    unavailable = 0
    while True:
        try:
            translator.refresh()
            unavailable = 0
        except Exception as exc:
            if not args.watch:
                raise
            unavailable += 1
            print("Public reader temporarily unavailable:", type(exc).__name__, flush=True)
            if unavailable >= 3:
                break
        if not args.watch:
            break
        time.sleep(120)
