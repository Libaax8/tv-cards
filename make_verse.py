"""Builds verse.json: one ayah a day for the TV home, with transliteration and an English translation.

Nothing here is written by hand or generated. Every word comes from quran.com's own data feed
(api.quran.com): the Arabic (Uthmani script, with quran.com's tajweed colouring), the
transliteration quran.com shows, and the Saheeh International translation. Before a verse is used, its Arabic is compared, letter for letter, with a
second, independent copy of the Quran (api.alquran.cloud, from Tanzil). A verse that does not match, or
that either source does not return, is not shown: the previous day's verse stays.

VERSES only chooses WHICH ayah is shown on a day; it holds references, never text.

Run:  python make_verse.py            writes verse.json next to this file (once a day)
      python make_verse.py --force    fetch again even if today's verse is already there
      python make_verse.py --check    go through every reference in VERSES and report
      python make_verse.py --key 2:255 [file]   that verse, printed or written to a file (for previews)
"""
import datetime as dt
import difflib
import json
import os
import re
import sys
import urllib.request
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Europe/Oslo")
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "verse.json")
TRANSLATION, TRANSLITERATION = 20, 57      # quran.com ids: Saheeh International, Transliteration
MAX_TRANSLATION = 1100                     # the screen shrinks the text to fit; past this it is too small to read

VERSES = """
2:255 2:285 2:286 2:152 2:153 2:155 2:186 2:201 2:216 2:263 2:269 2:277 3:8 3:31 3:38 3:54 3:92 3:133 3:139 3:173 3:200
4:28 4:110 6:17 6:54 6:162 7:23 7:31 7:55 7:56 7:199 7:205 8:2 8:46 9:51 9:119 9:129 10:57 10:62
11:6 11:114 12:86 12:87 13:28 14:7 14:40 14:41 15:9 15:49 15:99 16:18 16:90 16:97 16:127 16:128
17:24 17:80 17:82 18:10 18:46 20:14 20:25 20:114 21:35 21:83 21:87 21:107 23:1 23:2 23:97 23:118
25:63 25:74 26:80 28:24 29:45 29:57 29:69 30:21 31:17 31:18 33:21 33:41 33:56 33:70 35:15 39:10
39:53 40:60 41:30 41:34 42:19 42:30 49:10 49:13 50:16 51:55 51:56 53:39 55:13 55:60 59:10 59:18
59:22 62:10 64:11 64:16 65:2 65:3 67:2 67:13 68:4 71:10 73:8 76:9 87:14 93:5 93:11 94:5 94:6 96:1
99:7 99:8 103:3 108:2 112:1
""".split()


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "tv-cards", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def plain(html):
    """Text with footnote marks and tags taken out."""
    html = re.sub(r"<sup[^>]*>.*?</sup>", "", html or "", flags=re.S)
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", html)).strip()


TAJWEED = re.compile(r"<tajweed class=\"?([a-z_]+)\"?>(.*?)</tajweed>|<span class=\"?end\"?>(.*?)</span>", re.S)


def tajweed_parts(marked, arabic, number):
    """The verse as [[text, rule or ""], ...] for colouring, or None when the colours cannot be trusted.

    quran.com's tajweed text is written for its own font and spells a few marks differently from
    the plain Uthmani text. So its letters are NOT shown: only its rule names (qalaqah, ikhafa,
    madda_normal, ghunnah ...) are laid over the verified Uthmani text, character by character.
    Put back together, the parts are exactly that text, plus the verse number as the part "end".
    """
    theirs, rules, at = [], [], 0
    for m in TAJWEED.finditer(marked or ""):
        theirs.append(marked[at:m.start()])
        rules += [""] * (m.start() - at)
        if m.group(1):
            theirs.append(m.group(2))
            rules += [m.group(1)] * len(m.group(2))
        at = m.end()
    theirs.append((marked or "")[at:])
    rules += [""] * (len(marked or "") - at)
    theirs = "".join(theirs)
    if not theirs or "<" in theirs or ">" in theirs:
        return None
    match = difflib.SequenceMatcher(None, arabic, theirs, autojunk=False)
    if match.ratio() < 0.9:
        return None
    mine = [""] * len(arabic)
    for op, i1, i2, j1, j2 in match.get_opcodes():
        for i in range(i1, i2):
            if op == "equal":
                mine[i] = rules[j1 + i - i1]
            elif op == "replace":
                mine[i] = rules[min(j1 + i - i1, j2 - 1)]
    parts = []
    for ch, rule in zip(arabic, mine):
        if ch == " ":
            rule = ""
        if parts and parts[-1][1] == rule:
            parts[-1][0] += ch
        else:
            parts.append([ch, rule])
    if "".join(p[0] for p in parts) != arabic:
        return None
    digits = "".join(chr(0x0660 + int(d)) for d in str(number))
    return parts + [["۝" + digits, "end"]]


def letters(arabic):
    """Only the letters, with the spellings of alif, ya and hamza carriers made the same, to compare two copies."""
    s = re.sub("[آأإٱٲٳ]", "ا", arabic)
    s = s.replace("ى", "ي").replace("ؤ", "و").replace("ئ", "ي")
    return "".join(ch for ch in s if "ء" <= ch <= "ي" and ch != "ـ")


def fetch(key):
    """The verse from quran.com, checked against alquran.cloud. Returns (verse dict or None, why not)."""
    surah = int(key.split(":")[0])
    v = get("https://api.quran.com/api/v4/verses/by_key/%s?translations=%d,%d&fields=text_uthmani,text_uthmani_tajweed,text_imlaei_simple"
            % (key, TRANSLATION, TRANSLITERATION))["verse"]
    if v.get("verse_key") != key:
        return None, "quran.com answered with another verse"
    by_id = {t["resource_id"]: plain(t["text"]) for t in v.get("translations") or []}
    arabic, english, latin = (v.get("text_uthmani") or "").strip(), by_id.get(TRANSLATION), by_id.get(TRANSLITERATION)
    if not (arabic and english and latin):
        return None, "a part is missing"
    other = get("https://api.alquran.cloud/v1/ayah/%s/quran-simple-clean" % key)["data"]
    if other.get("numberInSurah") != v.get("verse_number") or other["surah"]["number"] != surah:
        return None, "the second source answered with another verse"
    # Like for like: quran.com's plain spelling against the second source's plain spelling. (The
    # Uthmani script on screen spells some words differently, so it is only checked loosely.) The
    # second source puts the basmala in front of a surah's first verse; it is not part of that verse.
    theirs = letters(other["text"])
    basmala = letters("بسم الله الرحمن الرحيم")
    if v.get("verse_number") == 1 and surah not in (1, 9) and theirs.startswith(basmala):
        theirs = theirs[len(basmala):]
    same = difflib.SequenceMatcher(None, letters(v.get("text_imlaei_simple") or ""), theirs).ratio()
    if same < 0.99:
        return None, "the Arabic differs between the two sources (%.2f)" % same
    if difflib.SequenceMatcher(None, letters(arabic), theirs).ratio() < 0.9:
        return None, "the Uthmani text does not fit the verse"
    if len(english) > MAX_TRANSLATION:
        return None, "too long for the screen"
    parts = tajweed_parts(v.get("text_uthmani_tajweed"), arabic, v.get("verse_number"))   # None: shown without the colours
    chapter = get("https://api.quran.com/api/v4/chapters/%d" % surah)["chapter"]
    return {
        "key": key,
        "reference": "%s %s" % (chapter["name_simple"], key),
        "surah_arabic": chapter["name_arabic"],
        "arabic": arabic,
        "tajweed": parts or [],
        "transliteration": latin,
        "translation": english,
        "translation_by": "Saheeh International",
        "source": "quran.com",
        "checked_against": "alquran.cloud (Tanzil)",
    }, ""


def main():
    today = dt.datetime.now(TZ).date()
    if "--check" in sys.argv:
        sys.stdout.reconfigure(encoding="utf-8")
        ok = 0
        for key in VERSES:
            try:
                v, why = fetch(key)
            except Exception as e:
                v, why = None, "error: %s" % e
            ok += bool(v)
            print("%-7s %s" % (key, "ok %4d %s %s" % (len(v["translation"]), "tajweed" if v["tajweed"] else "PLAIN  ", v["translation"][:50]) if v else "LEFT OUT: " + why))
        print("%d of %d can be shown" % (ok, len(VERSES)))
        return
    if "--key" in sys.argv:
        rest = sys.argv[sys.argv.index("--key") + 1:]
        verse, why = fetch(rest[0])
        if not verse:
            sys.exit("%s left out: %s" % (rest[0], why))
        verse["date"] = today.isoformat()
        text = json.dumps(verse, ensure_ascii=False, indent=2)
        if len(rest) > 1:
            with open(rest[1], "w", encoding="utf-8", newline=chr(10)) as f:
                f.write(text + chr(10))
        else:
            sys.stdout.reconfigure(encoding="utf-8")
            print(text)
        return
    try:
        with open(OUT, encoding="utf-8") as f:
            if json.load(f).get("date") == today.isoformat() and "--force" not in sys.argv:
                return
    except (OSError, ValueError):
        pass
    start = today.toordinal() % len(VERSES)
    for n in range(12):      # a verse that cannot be shown today: try the next ones in the list
        key = VERSES[(start + n) % len(VERSES)]
        try:
            verse, why = fetch(key)
        except Exception as e:
            verse, why = None, "error: %s" % e
        if verse:
            verse["date"] = today.isoformat()
            tmp = OUT + ".tmp"
            with open(tmp, "w", encoding="utf-8", newline="\n") as f:
                json.dump(verse, f, ensure_ascii=False, indent=2)
                f.write("\n")
            os.replace(tmp, OUT)
            print("verse of the day: %s" % verse["reference"])
            return
        print("%s left out: %s" % (key, why), file=sys.stderr)
    print("no verse could be checked today; the last one stays", file=sys.stderr)


if __name__ == "__main__":
    main()
