// Verse of the day on the home (an addition to couch-tv's home, not part of couch-tv).
// It only shows what verse.json holds: the ayah in Arabic with tajweed colours, its translation and
// its transliteration, grouped in one panel under a smaller clock. The text shrinks until the whole
// verse fits above the rows, so a long ayah (Ayat al-Kursi, the end of al-Baqarah) fits too.
// verse.json is made by make_verse.py in the tv-cards repo, which takes every word from quran.com
// and checks the Arabic against a second copy of the Quran. Display only: every string goes in
// with textContent.
(function () {
  var URL = "https://raw.githubusercontent.com/Libaax8/tv-cards/main/verse.json";
  var KEY = "tvcards:verse", EVERY_MIN = 30;
  // a preview on a computer (index.html?mock=1&dvsrc=...) may point at another file
  var pv = /[?&]mock=1/.test(location.search) && location.search.match(/[?&]dvsrc=([^&]+)/);
  if (pv) { URL = decodeURIComponent(pv[1]); KEY += ":preview"; }

  // quran.com's tajweed rules, in colours light enough to read over a dark photo
  var RULES = {
    ham_wasl: "#b9bec9", slnt: "#b9bec9", laam_shamsiyah: "#b9bec9",
    madda_normal: "#8fb6ff", madda_permissible: "#7fa2ff", madda_necessary: "#6d8cff", madda_obligatory: "#9aa8ff",
    qalaqah: "#ff7b72", ikhafa: "#e59cf2", ikhafa_shafawi: "#ff9be6", idgham_shafawi: "#a5e86f", iqlab: "#6fd6ff",
    idgham_ghunnah: "#62dcb8", idgham_wo_ghunnah: "#86df7f", idgham_mutajanisayn: "#c4c4c4",
    idgham_mutaqaribayn: "#c4c4c4", ghunnah: "#ffab66", end: "#ecc97a"
  };

  var css = "@font-face{font-family:'Amiri Quran';src:url('fonts/AmiriQuran-Regular.ttf') format('truetype');font-display:swap}" +
    ".dv{display:none;position:fixed;left:4vw;right:4vw;top:8.6vw;z-index:1;align-items:center;justify-content:center;pointer-events:none;color:#fff}" +
    ".theme-night .dv.on{display:flex}.theme-oled .dv.on{display:none}" +
    ".dv-card{max-width:92vw;min-width:34vw;box-sizing:border-box;padding:1vw 2.4vw 1.3vw;border-radius:1.5vw;" +
    "background:rgba(7,9,15,.6);border:1px solid rgba(255,255,255,.09);box-shadow:0 1vw 3vw rgba(0,0,0,.28);" +
    "text-shadow:0 1px 2px rgba(0,0,0,.55)}" +
    ".dv-arabic{font-family:'Amiri Quran','Noto Naskh Arabic',serif;direction:rtl;text-align:center;line-height:1.95}" +
    ".dv-ref{margin:.5vw 0 .7vw;text-align:center;font-size:.9vw;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#ecc97a}" +
    ".dv-cols{display:flex;flex-direction:column;align-items:center;text-align:center}" +
    ".dv-tr{font-weight:500;line-height:1.42}" +
    ".dv-lat{font-style:italic;line-height:1.42;opacity:.8;margin-top:.5vw}" +
    ".dv.wide .dv-card{width:92vw}" +
    ".dv.wide .dv-cols{flex-direction:row;align-items:flex-start;text-align:left}" +
    ".dv.wide .dv-tr,.dv.wide .dv-lat{flex:1 1 0;margin-top:0}.dv.wide .dv-lat{margin-left:3vw}" +
    // the clock steps up and gets small while a verse is showing; the date sits above it
    ".dv-on.theme-night .scene .gclock{font-size:5.2vw!important;top:3.1vw!important;left:0!important;right:0!important;text-align:center!important}" +
    ".dv-on.theme-night .scene .gclock.under{display:none!important}" +
    ".dv-on.theme-night .date{top:1.1vw!important;font-size:1.3vw!important;line-height:1.9vw!important}";

  function el(cls, parent) {
    var d = document.createElement("div");
    d.className = cls;
    if (parent) parent.appendChild(d);
    return d;
  }
  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
  var box = el("dv"), card = el("dv-card", box);
  var arabic = el("dv-arabic", card), ref = el("dv-ref", card), cols = el("dv-cols", card);
  var tr = el("dv-tr", cols), lat = el("dv-lat", cols);
  arabic.setAttribute("lang", "ar");
  var anchor = document.querySelector(".scrim");
  if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(box, anchor.nextSibling);
  else document.body.appendChild(box);

  function str(v, max) { return typeof v === "string" && v.length <= max ? v : ""; }

  // The space the verse may use: from under the small clock down to the first row of the home.
  function room() {
    var vw = window.innerWidth / 100, top = 8.6 * vw, bottom = window.innerHeight * 0.6;
    ["shelf-title", "shelf", "dock"].some(function (id) {
      var n = document.getElementById(id), r = n && n.getBoundingClientRect();
      if (r && r.height > 0 && r.top > top + 6 * vw) { bottom = r.top; return true; }
      return false;
    });
    return Math.max(8 * vw, bottom - top - 1.2 * vw);
  }
  // Text sizes for a step s from 1 (roomy) to 0 (smallest comfortable), then k below 1 shrinks further.
  function size(s, k) {
    var vw = window.innerWidth / 100;
    arabic.style.fontSize = (1.32 + (3.1 - 1.32) * s) * k * vw + "px";
    tr.style.fontSize = (1.0 + (1.55 - 1.0) * s) * k * vw + "px";
    lat.style.fontSize = (0.92 + (1.3 - 0.92) * s) * k * vw + "px";
  }
  function fit() {
    if (box.className.indexOf("on") < 0) return;
    var max = room(), s = 1, k = 1;
    box.style.height = max + "px";
    size(s, k);
    while (card.offsetHeight > max && s > 0) { s = Math.max(0, s - 0.04); size(s, k); }
    while (card.offsetHeight > max && k > 0.6) { k -= 0.03; size(s, k); }
  }

  function show(v) {
    if (!v || typeof v !== "object") return false;
    var a = str(v.arabic, 3000), t = str(v.translation, 2000), r = str(v.reference, 60);
    if (!a || !t || !r) return false;
    // tajweed: [[text, rule], ...] that must spell the verse exactly, else the plain text is shown
    var parts = Array.isArray(v.tajweed) ? v.tajweed : [], joined = "", ok = parts.length > 0;
    parts.forEach(function (p) {
      if (!Array.isArray(p) || typeof p[0] !== "string" || typeof p[1] !== "string") ok = false;
      else if (p[1] !== "end") joined += p[0];
    });
    arabic.textContent = "";
    if (ok && joined === a) {
      parts.forEach(function (p) {
        var span = document.createElement("span");
        span.textContent = (p[1] === "end" ? " " : "") + p[0];
        if (RULES[p[1]]) span.style.color = RULES[p[1]];
        arabic.appendChild(span);
      });
    } else {
      arabic.textContent = a;
    }
    ref.textContent = r;
    tr.textContent = t;
    lat.textContent = str(v.transliteration, 3000);
    box.className = "dv on" + (t.length > 230 ? " wide" : "");
    document.documentElement.classList.add("dv-on");
    fit();
    return true;
  }
  // ---- the data: a week of days (prayer times, cards, verse), kept on the TV ----
  // days.json is made ahead of time, so the home stays right when the job that makes it runs late.
  var DAYS_URL = "https://raw.githubusercontent.com/Libaax8/tv-cards/main/days.json";
  var CARDS_END = "/tv-cards/main/cards.json", DAYS_KEY = "tvcards:days", days = {}, shown = "";
  try { days = JSON.parse(localStorage.getItem(DAYS_KEY) || "{}") || {}; } catch (e) { days = {}; }

  function oslo(offsetDays) {   // {date: "2026-11-16", time: "13:45"} in the mosque's time zone
    var d = new Date(Date.now() + (offsetDays || 0) * 86400000), out = { date: "", time: "" };
    try {
      var p = {};
      new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Oslo", year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d).forEach(function (x) { p[x.type] = x.value; });
      out.date = p.year + "-" + p.month + "-" + p.day;
      out.time = (p.hour === "24" ? "00" : p.hour) + ":" + p.minute;
    } catch (e) {
      var z = function (n) { return (n < 10 ? "0" : "") + n; };
      out.date = d.getFullYear() + "-" + z(d.getMonth() + 1) + "-" + z(d.getDate());
      out.time = z(d.getHours()) + ":" + z(d.getMinutes());
    }
    return out;
  }
  // Today's cards, with "Next prayer" worked out from the TV's own clock. null: no data for today.
  function cardsNow() {
    var now = oslo(0), day = days[now.date], next = days[oslo(1).date];
    if (!day || !Array.isArray(day.prayers) || !Array.isArray(day.cards)) return null;
    var label = "Next prayer", p = null;
    day.prayers.some(function (x) { if (x[1] > now.time) { p = x; return true; } return false; });
    if (!p && next && Array.isArray(next.prayers) && next.prayers.length) { p = next.prayers[0]; label = "Next prayer, tomorrow"; }
    var first = p ? [{ subtitle: label, title: p[0] + " " + p[1], value: p[2] ? "Iqamah " + p[2] : "" }] : [];
    return first.concat(day.cards).slice(0, 8);
  }
  // couch-tv asks for cards.json every 10 minutes: answer from the days kept here, so the next
  // prayer is always by the clock. Without data for today the request goes out as usual.
  var realFetch = window.fetch;
  if (realFetch && window.Response) {
    window.fetch = function (input, init) {
      try {
        var u = typeof input === "string" ? input : (input && input.url) || "";
        var q = u.indexOf("?"), bare = q < 0 ? u : u.slice(0, q);
        if (!pv && bare.slice(-CARDS_END.length) === CARDS_END) {
          var cards = cardsNow();
          if (cards) return Promise.resolve(new Response(JSON.stringify({ cards: cards }), { status: 200, headers: { "Content-Type": "application/json" } }));
        }
      } catch (e) {}
      return realFetch.apply(this, arguments);
    };
  }
  function verseNow() {
    if (pv) return;
    var today = oslo(0).date, day = days[today];
    if (day && day.verse && shown !== today && show(day.verse)) shown = today;
  }
  function load() {
    if (!realFetch) return;
    if (pv) {
      realFetch.call(window, URL, { credentials: "omit", cache: "no-store" })
        .then(function (r) { return r.ok ? r.json() : null; }).then(show, function () {});
      return;
    }
    realFetch.call(window, DAYS_URL, { credentials: "omit", cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (j && j.days && typeof j.days === "object") {
          // keep days already here that the new file no longer lists (yesterday), drop old ones
          var keep = {}, from = oslo(-1).date;
          Object.keys(days).concat(Object.keys(j.days)).forEach(function (k) { if (k >= from) keep[k] = j.days[k] || days[k]; });
          days = keep;
          shown = "";
          try { localStorage.setItem(DAYS_KEY, JSON.stringify(days)); } catch (e) {}
        }
        verseNow();
        if (!shown) {   // nothing for today yet: the single verse file, as before
          realFetch.call(window, URL, { credentials: "omit", cache: "no-store" })
            .then(function (r) { return r.ok ? r.json() : null; }).then(show, function () {});
        }
      }, function () { verseNow(); });
  }
  verseNow();
  if (!shown) { try { show(JSON.parse(localStorage.getItem(KEY) || "null")); } catch (e) {} }
  load();
  setInterval(load, EVERY_MIN * 60000);
  setInterval(verseNow, 5 * 60000);   // midnight: the next day's verse, from the days kept here
  // the rows and the font arrive after the first draw: measure again
  window.addEventListener("resize", fit);
  [600, 2000, 5000].forEach(function (ms) { setTimeout(fit, ms); });
  setInterval(fit, 60000);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit, function () {});
})();
