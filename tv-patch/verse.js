// Verse of the day beside the clock (an addition to couch-tv's home, not part of couch-tv).
// It only shows what verse.json holds: the ayah in Arabic on the left of the clock, its translation
// and transliteration on the right. verse.json is made by make_verse.py in the tv-cards repo, which
// takes every word from quran.com and checks the Arabic against a second copy of the Quran.
// Display only: every string goes in with textContent.
(function () {
  var URL = "https://raw.githubusercontent.com/Libaax8/tv-cards/main/verse.json";
  var KEY = "tvcards:verse", EVERY_MIN = 30;

  var css = "@font-face{font-family:'Amiri Quran';src:url('fonts/AmiriQuran-Regular.ttf') format('truetype');font-display:swap}" +
    ".dv{display:none;position:fixed;top:15vh;width:26vw;z-index:1;color:#fff;pointer-events:none;" +
    "text-shadow:0 1px 3px rgba(0,0,0,.75),0 0 20px rgba(0,0,0,.5)}" +
    ".theme-night .dv.on{display:block}.theme-oled .dv.on{display:none}" +
    ".dv-ar{left:4.2vw;text-align:center}.dv-en{right:4.2vw;text-align:left}" +
    ".dv-arabic{font-family:'Amiri Quran','Noto Naskh Arabic',serif;font-size:2.3vw;line-height:2.15;direction:rtl}" +
    ".dv-arabic.long{font-size:1.85vw}" +
    ".dv-ref{margin-top:1.2vh;font-size:.95vw;font-weight:600;letter-spacing:.14em;text-transform:uppercase;opacity:.85}" +
    ".dv-tr{font-size:1.3vw;line-height:1.45;font-weight:500}.dv-tr.long{font-size:1.12vw}" +
    ".dv-lat{margin-top:1.4vh;font-size:.98vw;line-height:1.45;font-style:italic;opacity:.78}" +
    ".dv-by{margin-top:1.4vh;font-size:.72vw;letter-spacing:.08em;text-transform:uppercase;opacity:.6}";

  function el(cls, parent) {
    var d = document.createElement("div");
    d.className = cls;
    if (parent) parent.appendChild(d);
    return d;
  }
  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
  var left = el("dv dv-ar"), right = el("dv dv-en");
  var arabic = el("dv-arabic", left), ref = el("dv-ref", left);
  var tr = el("dv-tr", right), lat = el("dv-lat", right), by = el("dv-by", right);
  arabic.setAttribute("lang", "ar");
  var anchor = document.querySelector(".scrim");
  if (anchor && anchor.parentNode) {
    anchor.parentNode.insertBefore(right, anchor.nextSibling);
    anchor.parentNode.insertBefore(left, anchor.nextSibling);
  } else {
    document.body.appendChild(left);
    document.body.appendChild(right);
  }

  function str(v, max) { return typeof v === "string" && v.length <= max ? v : ""; }
  function show(v) {
    if (!v || typeof v !== "object") return false;
    var a = str(v.arabic, 400), t = str(v.translation, 500), r = str(v.reference, 60);
    if (!a || !t || !r) return false;
    arabic.textContent = a;
    arabic.className = "dv-arabic" + (a.length > 110 ? " long" : "");
    ref.textContent = r;
    tr.textContent = "“" + t + "”";
    tr.className = "dv-tr" + (t.length > 170 ? " long" : "");
    lat.textContent = str(v.transliteration, 600);
    by.textContent = [str(v.translation_by, 60), str(v.source, 40)].filter(Boolean).join(" · ");
    left.className = "dv dv-ar on";
    right.className = "dv dv-en on";
    return true;
  }
  function load() {
    if (!window.fetch) return;
    fetch(URL, { credentials: "omit", cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (v) {
        if (show(v)) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} }
      }, function () {});
  }
  try { show(JSON.parse(localStorage.getItem(KEY) || "null")); } catch (e) {}
  load();
  setInterval(load, EVERY_MIN * 60000);
})();
