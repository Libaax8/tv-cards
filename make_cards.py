"""Builds cards.json for couch-tv's custom cards: prayer times and Islamic reminders.

The times are Tawfiiq Islamsk Senter's own timetable, read from the public feed behind the clock on
tawfiiq.no (my-masjid.com). The feed holds the whole year, so a copy is kept in timetable.json and
only refreshed once a day; if the feed is down the copy is used.

Run:  python make_cards.py            writes cards.json next to this file
      python make_cards.py --print    also prints it
"""
import datetime as dt
import json
import math
import os
import sys
import urllib.request
from zoneinfo import ZoneInfo

FEED = ("https://time.my-masjid.com/api/TimingsInfoScreen/GetMasjidTimings"
        "?GuidId=180b67f1-2ce8-40bd-8986-77529a4aa9f7")
TZ = ZoneInfo("Europe/Oslo")
HERE = os.path.dirname(os.path.abspath(__file__))
TABLE = os.path.join(HERE, "timetable.json")

# (card name, the feed's key for the adhan, the feed's key for the iqamah)
PRAYERS = [("Fajr", "fajr", "iqamah_Fajr"), ("Dhuhr", "zuhr", "iqamah_Zuhr"), ("Asr", "asr", "iqamah_Asr"),
           ("Maghrib", "maghrib", "iqamah_Maghrib"), ("Isha", "isha", "iqamah_Isha")]
HIJRI_MONTHS = ["Muharram", "Safar", "Rabi I", "Rabi II", "Jumada I", "Jumada II", "Rajab",
                "Sha'ban", "Ramadan", "Shawwal", "Dhul Qa'dah", "Dhul Hijjah"]
DHIKR = [   # (the big line, the small line under it: 24 characters at most)
    ("SubhanAllah", "33 times after prayer"),
    ("Alhamdulillah", "33 times after prayer"),
    ("Allahu Akbar", "34 times after prayer"),
    ("Astaghfirullah", "100 times a day"),
    ("La ilaha illa Allah", "The best dhikr"),
    ("Salawat on the Prophet", "Most of all on Friday"),
    ("Hasbunallah", "Allah is enough for us"),
]


# ---------- the timetable ----------
def load_table(today):
    """The saved timetable, fetched again when it is from another day (or missing)."""
    saved = None
    try:
        with open(TABLE, encoding="utf-8") as f:
            saved = json.load(f)
    except (OSError, ValueError):
        pass
    if saved and saved.get("fetched") == today.isoformat():
        return saved
    try:
        req = urllib.request.Request(FEED, headers={"User-Agent": "tv-cards"})
        with urllib.request.urlopen(req, timeout=30) as r:
            model = json.load(r)["model"]
        days = {"%02d-%02d" % (d["month"], d["day"]): {k: d[k] for k in d if k not in ("day", "month")}
                for d in model["salahTimings"]}
        if len(days) < 365:
            raise ValueError("short timetable")
        settings = model.get("masjidSettings") or {}
        fresh = {"fetched": today.isoformat(), "jumah": settings.get("jumahTime") or "",
                 "jumah_iqamah_minutes": (model.get("iqamahTimings") or {}).get("jumah") or 0,
                 "hijri_offset": settings.get("hijriOffset") or 0, "days": days}
        tmp = TABLE + ".tmp"
        with open(tmp, "w", encoding="utf-8", newline="\n") as f:
            json.dump(fresh, f, ensure_ascii=False, indent=1, sort_keys=True)
        os.replace(tmp, TABLE)
        return fresh
    except Exception as e:   # the feed is down or changed: carry on with the copy
        print("feed not read (%s), using the saved timetable" % e, file=sys.stderr)
        if saved:
            return saved
        raise


def day_times(table, day):
    row = table["days"].get(day.strftime("%m-%d")) or {}

    def at(key):
        try:
            h, m = (row.get(key) or "").split(":")
            return dt.datetime(day.year, day.month, day.day, int(h), int(m), tzinfo=TZ)
        except ValueError:
            return None
    return {key: at(key) for key in row}


# ---------- Hijri date ----------
def hijri(day, offset=0):
    """(year, month, day). Umm al-Qura when the hijridate package is there, else the tabular calendar."""
    day = day + dt.timedelta(days=offset)
    try:
        from hijridate import Gregorian
        h = Gregorian(day.year, day.month, day.day).to_hijri()
        return h.year, h.month, h.day
    except Exception:
        pass
    days = math.floor(day.toordinal() + 1721424.5) - 1948440 + 10632
    n = (days - 1) // 10631
    days = days - 10631 * n + 354
    j = ((10985 - days) // 5316) * ((50 * days) // 17719) + (days // 5670) * ((43 * days) // 15238)
    days = days - ((30 - j) // 15) * ((17719 * j) // 50) - (j // 16) * ((15238 * j) // 43) + 29
    month = (24 * days) // 709
    return 30 * n + j - 30, month, days - (709 * month) // 24


def days_until_hijri(day, month, offset=0):
    for n in range(1, 400):
        _, m, d = hijri(day + dt.timedelta(days=n), offset)
        if m == month and d == 1:
            return n
    return None


# ---------- the cards ----------
def hm(t):
    return t.strftime("%H:%M")


def card(label, big, small=""):
    """couch-tv draws "subtitle" as the small top line, "title" big, and "value" small underneath."""
    return {"subtitle": label[:60], "title": big[:40], "value": small[:24]}


def build(now=None, table=None):
    now = now or dt.datetime.now(TZ)
    today = now.date()
    table = table or load_table(today)
    off = table.get("hijri_offset") or 0
    times = day_times(table, today)
    tomorrow = day_times(table, today + dt.timedelta(days=1))
    cards = []

    # 1. next prayer, with its iqamah
    upcoming = [(n, times.get(a), times.get(i)) for n, a, i in PRAYERS]
    upcoming = [u for u in upcoming if u[1] and u[1] > now]
    upcoming += [(n, tomorrow.get(a), tomorrow.get(i)) for n, a, i in PRAYERS if tomorrow.get(a)]
    if upcoming:
        name, when, iqamah = upcoming[0]
        label = "Next prayer" if when.date() == today else "Next prayer, tomorrow"
        cards.append(card(label, "%s %s" % (name, hm(when)), "Iqamah %s" % hm(iqamah) if iqamah else ""))

    # 2. the whole day, two times to a card
    def pair(label, first, a, second, b):
        if times.get(a):
            small = "%s %s" % (second, hm(times[b])) if times.get(b) else ""
            cards.append(card(label, "%s %s" % (first, hm(times[a])), small))
    pair("Morning, Tawfiiq", "Fajr", "fajr", "Sunrise", "shouruq")
    pair("Midday", "Dhuhr", "zuhr", "Asr", "asr")
    pair("Evening", "Maghrib", "maghrib", "Isha", "isha")

    # 3. Jumu'ah
    to_friday = (4 - today.weekday()) % 7
    when = "Today" if to_friday == 0 else "Tomorrow" if to_friday == 1 else "Friday"
    khutbah = table.get("jumah") or ""
    small = "In %d days" % to_friday
    try:
        h, m = khutbah.split(":")
        prayer = dt.datetime(2000, 1, 1, int(h), int(m)) + dt.timedelta(minutes=table.get("jumah_iqamah_minutes") or 0)
        small = "Prayer %s" % hm(prayer) if to_friday < 2 else small
    except ValueError:
        pass
    cards.append(card("Jumu'ah", ("%s %s" % (when, khutbah)).strip(), small))

    # 4. Hijri date and the countdown to Ramadan
    hy, hmonth, hd = hijri(today, off)
    left = days_until_hijri(today, 9, off)
    small = "Ramadan Mubarak" if hmonth == 9 else ("Ramadan in ~%d days" % left if left else "")
    cards.append(card("Hijri date", "%d %s %d" % (hd, HIJRI_MONTHS[hmonth - 1], hy), small))

    # 5. the next sunnah fast (Mondays, Thursdays, and the white days 13 to 15)
    if hmonth != 9:
        for n in range(1, 8):
            day = today + dt.timedelta(days=n)
            _, m2, d2 = hijri(day, off)
            white = d2 in (13, 14, 15)
            if m2 != 9 and (day.weekday() in (0, 3) or white):
                fajr = day_times(table, day).get("fajr")
                label = ("White day fast" if white else "Sunnah fast") + (" tomorrow" if n == 1 else "")
                cards.append(card(label, day.strftime("%A"), "Suhoor before %s" % hm(fajr) if fajr else ""))
                break

    # 6. dhikr of the day
    big, small = DHIKR[today.toordinal() % len(DHIKR)]
    cards.append(card("Dhikr of the day", big, small))
    return {"cards": cards[:8]}


if __name__ == "__main__":
    data = build()
    tmp = os.path.join(HERE, "cards.json.tmp")
    with open(tmp, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.replace(tmp, os.path.join(HERE, "cards.json"))
    if "--print" in sys.argv:
        sys.stdout.reconfigure(encoding="utf-8")
        for c in data["cards"]:
            print("%-22s | %-24s | %s" % (c["subtitle"], c["title"], c["value"]))
