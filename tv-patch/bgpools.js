// Picture pools for the scenes (an addition to couch-tv's home, not part of couch-tv).
// couch-tv has five scenes, one for each part of the day (dawn, day, overcast day, golden hour,
// night), and with "Follow the sun" it shows the one that fits the sun's height. This gives each
// of those five a pool of photos instead of one: every time a scene comes on it shows the next
// photo of its pool, and a scene that stays on (Follow the sun) changes photo every 10 minutes.
// The photos are in backgrounds/mine/isl/, 1920x1080 and 3840x2160 ("@2x") copies of each.
(function () {
  var POOLS = /*POOLS*/{"dawn": ["dawn-01", "dawn-02", "dawn-03", "dawn-04"], "day": ["day-01", "day-02", "day-03", "day-04", "day-05", "day-06", "day-07", "day-08"], "fog": ["fog-01", "fog-02", "fog-03", "fog-04"], "golden": ["golden-01", "golden-02", "golden-03", "golden-04", "golden-05", "golden-06"], "night": ["night-01", "night-02", "night-03", "night-04", "night-05"]}/*END*/;
  var SLOT = { dawn: "dawn", water: "day", fog: "fog", golden: "golden", night: "night" };   // couch-tv's scene -> pool
  var STAY_MIN = 10;
  // the 4K copies whenever the screen is really drawn with that many pixels
  var hi = (window.devicePixelRatio || 1) * window.innerWidth >= 3000;
  var at = {}, was = {}, dead = {};
  Object.keys(POOLS).forEach(function (k) { at[k] = Math.floor(Date.now() / 86400000) % Math.max(1, POOLS[k].length); });

  var style = document.createElement("style");
  style.textContent = ".scene img.sbg{transition:opacity 900ms ease-in-out}" +
    // the small clock: plain glass white (the photo behind it changes, so it is not cut from one photo)
    ".dv-on .scene .gclock .fill{background-image:none!important;color:rgba(255,255,255,.86)!important}";
  document.head.appendChild(style);

  function file(pool) { return "backgrounds/mine/isl/" + POOLS[pool][at[pool]] + (hi ? "@2x" : "") + ".jpg"; }
  function put(el, pool) {
    var img = el.querySelector("img.sbg"), list = POOLS[pool];
    if (!img || !list || !list.length || dead[pool]) return;
    var want = file(pool);
    if (img.getAttribute("src") !== want) {
      if (!img.getAttribute("data-own") && img.getAttribute("src")) img.setAttribute("data-own", img.getAttribute("src"));
      img.onerror = function () {   // a photo missing from this build: couch-tv's own scene comes back
        dead[pool] = true;
        if (img.getAttribute("data-own")) img.src = img.getAttribute("data-own");
        var f = el.querySelector("img.fg"); if (f) f.style.display = "";
      };
      img.src = want;
    }
    var fg = el.querySelector("img.fg");
    if (fg) fg.style.display = "none";   // the cut-out belongs to couch-tv's photo, not to these
  }
  function next(pool) { at[pool] = (at[pool] + 1) % POOLS[pool].length; }
  function each(fn) {
    Object.keys(SLOT).forEach(function (id) {
      var el = document.querySelector(".scene.s-" + id);
      if (el && POOLS[SLOT[id]] && POOLS[SLOT[id]].length) fn(id, el, SLOT[id]);
    });
  }
  function tick() {
    each(function (id, el, pool) {
      var on = el.classList.contains("on");
      if (was[id] && !on) next(pool);          // it just went away: another photo next time
      was[id] = on;
      if (el.querySelector("img.sbg").getAttribute("src")) put(el, pool);
    });
  }
  // a scene that stays on: fade to the next photo of its pool
  function stay() {
    each(function (id, el, pool) {
      if (!el.classList.contains("on") || POOLS[pool].length < 2 || dead[pool]) return;
      var img = el.querySelector("img.sbg");
      img.style.opacity = "0";
      setTimeout(function () {
        next(pool);
        var show = function () { img.style.opacity = ""; img.removeEventListener("load", show); };
        img.addEventListener("load", show);
        put(el, pool);
        setTimeout(show, 4000);
      }, 950);
    });
  }
  setInterval(tick, 1000);
  setInterval(stay, STAY_MIN * 60000);
  var box = document.getElementById("scenes");
  if (box && window.MutationObserver) new MutationObserver(tick).observe(box, { subtree: true, attributes: true, attributeFilter: ["src"], childList: true });
})();
