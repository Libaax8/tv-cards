"""Adds the verse of the day panel to a couch-tv checkout (run again after updating couch-tv).

Usage:  python apply_patch.py <path to the couch-tv folder>

It copies verse.js and the Amiri Quran font into tv-home/web and adds one <script> line to
tv-home/web/index.html. Build the app afterwards (docs/SETUP.md, "Building the app") and run
apply.sh. To take it out again: git checkout tv-home/web/index.html in the couch-tv folder.
"""
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
TAG = '<script src="verse.js"></script>'
TAG2 = '<script src="bgpools.js"></script>'
BEFORE = '<script src="cards.js"></script>'


def main():
    web = os.path.join(sys.argv[1], "tv-home", "web")
    shutil.copyfile(os.path.join(HERE, "verse.js"), os.path.join(web, "verse.js"))
    shutil.copyfile(os.path.join(HERE, "bgpools.js"), os.path.join(web, "bgpools.js"))
    shutil.copyfile(os.path.join(HERE, "AmiriQuran-Regular.ttf"), os.path.join(web, "fonts", "AmiriQuran-Regular.ttf"))
    shutil.copyfile(os.path.join(HERE, "AmiriQuran-OFL.txt"), os.path.join(web, "fonts", "AmiriQuran-OFL.txt"))
    page = os.path.join(web, "index.html")
    with open(page, encoding="utf-8", newline="") as f:
        html = f.read()
    if BEFORE not in html:
        sys.exit("index.html has changed: could not find where to add the scripts")
    for tag in (TAG, TAG2):
        if tag not in html:
            html = html.replace(BEFORE, tag + chr(10) + BEFORE, 1)
            print("added", tag)
    with open(page, "w", encoding="utf-8", newline="") as f:
        f.write(html)


if __name__ == "__main__":
    main()
