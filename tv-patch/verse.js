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
    "background:rgba(7,9,15,.44);border:1px solid rgba(255,255,255,.09);box-shadow:0 1vw 3vw rgba(0,0,0,.28);" +
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
    tr.textContent = "“" + t + "”";
    lat.textContent = str(v.transliteration, 3000);
    box.className = "dv on" + (t.length > 230 ? " wide" : "");
    document.documentElement.classList.add("dv-on");
    fit();
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
  // the rows and the font arrive after the first draw: measure again
  window.addEventListener("resize", fit);
  [600, 2000, 5000].forEach(function (ms) { setTimeout(fit, ms); });
  setInterval(fit, 60000);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit, function () {});
})();
