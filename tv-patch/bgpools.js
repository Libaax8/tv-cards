// Picture pools for the scenes (an addition to couch-tv's home, not part of couch-tv).
// couch-tv has five scenes, one for each part of the day (dawn, day, overcast day, golden hour,
// night), and with "Follow the sun" it shows the one that fits the sun's height. This gives each
// of those five a pool of photos instead of one: every time a scene comes on it shows the next
// photo of its pool, and a scene that stays on (Follow the sun) changes photo every 10 minutes.
// Mosque photos (backgrounds/mine/isl/), nature photos (backgrounds/mine/nat/) and couch-tv's own
// scene photos take turns. Each has a 1920x1080 and a 3840x2160 ("@2x") copy.
(function () {
  var POOLS = /*POOLS*/{"dawn": ["mine/isl/dawn-01", "mine/land/dawn-so15", "scene-dawn", "mine/isl/dawn-02", "mine/land/dawn-lk49", "mine/nat/dawn-01", "mine/isl/dawn-03", "mine/land/dawn-lk51", "mine/nat/dawn-02", "mine/isl/dawn-04", "mine/land/dawn-lk48", "mine/nat/dawn-03"], "day": ["mine/isl/day-01", "mine/land/day-so16", "scene-water", "mine/isl/day-02", "mine/land/day-lk31", "mine/nat/day-01", "mine/isl/day-03", "mine/nat/day-02", "mine/isl/day-04", "mine/land/day-lk35", "mine/nat/day-03", "mine/isl/day-05", "mine/land/day-so03", "mine/nat/day-04", "mine/isl/day-06", "mine/land/day-lk39", "mine/isl/day-07", "mine/land/day-so08", "mine/isl/day-08", "mine/land/day-lk70", "mine/land/day-lk59"], "fog": ["mine/isl/fog-01", "mine/land/fog-so04", "scene-fog", "mine/isl/fog-02", "mine/land/fog-lk53", "mine/nat/fog-01", "mine/isl/fog-03", "mine/land/fog-lk55", "mine/nat/fog-02", "mine/isl/fog-04", "mine/land/fog-lk30", "mine/nat/fog-03", "mine/nat/fog-04"], "golden": ["mine/isl/golden-01", "mine/land/golden-so18", "scene-golden", "mine/isl/golden-02", "mine/land/golden-lk40", "mine/nat/golden-01", "mine/isl/golden-03", "mine/land/golden-lk43", "mine/nat/golden-02", "mine/isl/golden-04", "mine/land/golden-lk52", "mine/isl/golden-05", "mine/isl/golden-06"], "night": ["mine/isl/night-01", "mine/land/night-lk46", "scene-night", "mine/isl/night-02", "mine/nat/night-01", "mine/isl/night-03", "mine/nat/night-02", "mine/isl/night-04", "mine/nat/night-03", "mine/isl/night-05", "mine/nat/night-04"]}/*END*/;
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

  function file(pool) { return "backgrounds/" + POOLS[pool][at[pool]] + (hi ? "@2x" : "") + ".jpg"; }
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
