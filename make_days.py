"""Builds days.json: everything the TV needs for the next days, so it does not depend on this job running on time.

For each of the next DAYS days: the prayer times (for the TV to work out the next prayer by its own
clock), that day's reminder cards, and that day's checked verse. The TV keeps a copy, so the home
stays right for a week even if this job, GitHub or the internet is late or down.

Run:  python make_days.py
"""
import datetime as dt
import json
import os
import sys

import make_cards
import make_verse

DAYS = 8
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "days.json")


def main():
    today = dt.datetime.now(make_cards.TZ).date()
    table = make_cards.load_table(today)
    try:
        with open(OUT, encoding="utf-8") as f:
            old = json.load(f).get("days") or {}
    except (OSError, ValueError):
        old = {}
    days = {}
    for n in range(DAYS):
        day = today + dt.timedelta(days=n)
        key = day.isoformat()
        start = dt.datetime(day.year, day.month, day.day, 0, 0, 1, tzinfo=make_cards.TZ)
        cards = [c for c in make_cards.build(start, table)["cards"] if not c["subtitle"].startswith("Next prayer")]
        times = make_cards.day_times(table, day)
        prayers = [[name, make_cards.hm(times[a]), make_cards.hm(times[i]) if times.get(i) else ""]
                   for name, a, i in make_cards.PRAYERS if times.get(a)]
        # a verse already checked for that date is kept, so the feeds are asked once per day and verse
        verse = (old.get(key) or {}).get("verse")
        want = make_verse.VERSES[make_verse.first_choice(day)]
        if not verse or (verse.get("picked") != want) or "--force" in sys.argv:
            verse = make_verse.verse_for(day) or verse
            if verse:
                verse["picked"] = want
        days[key] = {"prayers": prayers, "cards": cards, "verse": verse}
    tmp = OUT + ".tmp"
    with open(tmp, "w", encoding="utf-8", newline=chr(10)) as f:
        json.dump({"made": today.isoformat(), "days": days}, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, OUT)
    print("days.json: %s to %s" % (min(days), max(days)))


if __name__ == "__main__":
    main()
