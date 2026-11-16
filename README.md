# tv-cards

Reminder cards for a [couch-tv](https://github.com/Seagey/couch-tv) home screen: the next prayer, the
day's prayer times, Jumu'ah, the Hijri date, the next sunnah fast and a dhikr of the day.

`make_cards.py` writes `cards.json`. A GitHub Action runs it every 15 minutes and commits the file
when it changed. The TV home reads the raw `cards.json` link (`home.custom_cards` in couch-tv's
`config.json`).

Prayer times are Tawfiiq Islamsk Senter's timetable, from the public feed behind the clock on
tawfiiq.no. `timetable.json` is a saved copy, refreshed once a day.

`preview_server.py` is for trying the cards on a computer: it shows couch-tv's preview home with
these cards in place of its samples.
