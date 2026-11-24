/* VARMLA — all behaviour, plain JavaScript, no dependencies. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var pad = function (n) { return String(n).padStart(2, "0"); };
  var seg = function (t, a, d) { return clamp((t - a) / d, 0, 1); };
  var E = {
    inOut: function (t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; },
    out: function (t) { return 1 - (1 - t) * (1 - t); },
    expo: function (t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); }
  };
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isM = function () { return innerWidth <= 768; };
  var mouse = { x: innerWidth / 2, y: innerHeight / 2 };
  addEventListener("mousemove", function (e) { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
  var store = {
    get: function (k) { try { return JSON.parse(localStorage.getItem("varmla_" + k)); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem("varmla_" + k, JSON.stringify(v)); } catch (e) {} }
  };
  var X = '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2"><path d="m1 1 10 10M11 1 1 11"/></svg>';

  /* ---------- frame loop: every scroll effect registers here ---------- */
  var tick = [];
  var VH = innerHeight, SY = scrollY;
  function loop(now) { VH = innerHeight; SY = scrollY; for (var i = 0; i < tick.length; i++) tick[i](now); requestAnimationFrame(loop); }
  requestAnimationFrame(loop);
  /* progress of a tall "pin" wrapper whose child is sticky: 0 when it pins, 1 when it lets go */
  function pinP(el) { var r = el.getBoundingClientRect(); return clamp(-r.top / Math.max(1, r.height - VH), 0, 1); }
  function viewP(el) { var r = el.getBoundingClientRect(); return clamp((VH - r.top) / (VH + r.height), 0, 1); }
  function near(el) { var r = el.getBoundingClientRect(); return r.bottom > -VH * .5 && r.top < VH * 1.5; }
  /* scrubbed value with easing lag (frame-rate independent) */
  function scrub(el, get, apply, lag) {
    var cur = null, last = 0;
    tick.push(function (now) {
      if (!near(el) && cur !== null) return;
      var to = get(); var dt = Math.min(.1, (now - last) / 1000 || .016); last = now;
      if (cur === null || reduced) cur = to; else cur = lerp(cur, to, 1 - Math.exp(-dt / Math.max(.001, lag)));
      if (Math.abs(cur - to) < .0002) cur = to;
      apply(cur, now);
    });
  }

  /* ---------- smooth wheel scroll ---------- */
  (function () {
    if (reduced || "ontouchstart" in window) return;
    var target = scrollY, cur = scrollY, running = false;
    function step() {
      cur = lerp(cur, target, .105);
      if (Math.abs(cur - target) < .4) { cur = target; running = false; }
      scrollTo({ top: cur, behavior: "instant" });
      if (running) requestAnimationFrame(step);
    }
    function go(to) { target = clamp(to, 0, document.documentElement.scrollHeight - innerHeight); if (!running) { cur = scrollY; running = true; requestAnimationFrame(step); } }
    addEventListener("wheel", function (e) {
      if (e.ctrlKey || document.body.classList.contains("lock")) return;
      var n = e.target;
      while (n && n !== document.body && n.nodeType === 1) { var o = getComputedStyle(n).overflowY; if ((o === "auto" || o === "scroll") && n.scrollHeight > n.clientHeight + 2 && n !== document.documentElement) return; n = n.parentNode; }
      e.preventDefault(); if (!running) target = scrollY;
      go(target + e.deltaY * (e.deltaMode === 1 ? 32 : 1));
    }, { passive: false });
    window.varmlaScroll = go;
  })();
  function scrollToY(y) { if (window.varmlaScroll) window.varmlaScroll(y); else scrollTo({ top: y, behavior: reduced ? "auto" : "smooth" }); }

  /* ---------- preloader: a tilted window opens, then the blur clears ---------- */
  var readyCbs = [], ready = false;
  function onReady(f) { ready ? f() : readyCbs.push(f); }
  function fireReady() { if (ready) return; ready = true; readyCbs.forEach(function (f) { f(); }); }
  (function () {
    var cover = $("#cover"), header = $(".header");
    if (reduced) { cover && cover.remove(); setTimeout(fireReady, 0); return; }
    header && header.classList.add("pre");
    var w = innerWidth, h = innerHeight, wrap = document.createElement("div"), cv = document.createElement("canvas"), bl = document.createElement("div");
    wrap.style.cssText = "position:fixed;inset:0;z-index:999999;pointer-events:none";
    bl.style.cssText = "position:absolute;inset:0;backdrop-filter:blur(18px)";
    cv.width = w; cv.height = h; cv.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
    wrap.append(bl, cv); document.body.append(wrap); cover && cover.remove();
    var c = cv.getContext("2d"), ink = getComputedStyle(document.documentElement).getPropertyValue("--ink");
    function hole(t) {
      c.globalCompositeOperation = "source-over"; c.clearRect(0, 0, w, h); if (t >= 1) return;
      c.fillStyle = ink; c.fillRect(0, 0, w, h); c.save(); c.translate(w / 2, h / 2); c.rotate(-8 * (1 - t) * Math.PI / 180); c.globalCompositeOperation = "destination-out";
      var k = .06 + t * 1.44; c.fillRect(-w * k / 2, -h * k / 2, w * k, h * k); c.restore();
    }
    hole(0);
    var t0 = performance.now(), phase = 0, t1 = 0;
    var crit = [document.fonts ? document.fonts.ready : null];
    $$(".hero img,.phero>img,.chero>img").slice(0, 3).forEach(function (i) { crit.push(i.complete ? null : new Promise(function (r) { i.onload = i.onerror = r; })); });
    var loaded = false; Promise.race([Promise.all(crit), new Promise(function (r) { setTimeout(r, 3000); })]).then(function () { loaded = true; });
    (function run(now) {
      if (phase === 0) { var t = clamp((now - t0) / 450, 0, 1); hole(t); if (t >= 1 && loaded) { phase = 1; t1 = now; header && header.classList.remove("pre"); setTimeout(fireReady, 300); } }
      else { var b = 18 * (1 - clamp((now - t1) / 350, 0, 1)); bl.style.backdropFilter = b > .3 ? "blur(" + b.toFixed(1) + "px)" : "none"; if (b <= 0) { wrap.remove(); return; } }
      requestAnimationFrame(run);
    })(t0);
    setTimeout(function () { wrap.remove(); header && header.classList.remove("pre"); fireReady(); }, 5000);
  })();

  /* ---------- line-by-line text reveal ---------- */
  function splitLines(el) {
    if (el._html == null) el._html = el.innerHTML;
    el.innerHTML = el._html;
    var words = [];
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          n.textContent.split(/(\s+)/).forEach(function (w) { if (!w.trim()) return; words.push({ t: w }); });
        } else if (n.nodeName === "BR") words.push({ br: 1 });
        else words.push({ n: n });
      });
    })(el);
    el.innerHTML = "";
    words.forEach(function (w) { if (w.br) { el.append(document.createElement("br")); return; } var s = document.createElement("span"); s.style.display = "inline-block"; if (w.n) s.append(w.n); else s.textContent = w.t; w.s = s; el.append(s, " "); });
    var lines = [], top = null;
    words.forEach(function (w) { if (!w.s) { top = null; return; } var y = w.s.offsetTop + w.s.offsetHeight / 2; if (top === null || Math.abs(y - top) > w.s.offsetHeight * .5) { lines.push([]); top = y; } lines[lines.length - 1].push(w); });
    el.innerHTML = "";
    return lines.map(function (ws, i) {
      var o = document.createElement("span"), n = document.createElement("span"); o.className = "ln pre"; n.style.setProperty("--i", i);
      ws.forEach(function (w, k) { if (w.n) n.append(w.n); else n.append(w.t); if (k < ws.length - 1) n.append(" "); }); o.append(n); el.append(o); return o;
    });
  }
  function playLines(el) {
    var lines = splitLines(el);
    el.style.visibility = "visible"; void el.offsetHeight;
    requestAnimationFrame(function () { requestAnimationFrame(function () { lines.forEach(function (l) { l.classList.remove("pre"); l.classList.add("go"); }); }); });
    clearTimeout(el._rt); el._rt = setTimeout(function () { el.innerHTML = el._html; }, 1400 + lines.length * 150);
  }
  (function () {
    if (innerWidth < 769 || reduced) return;
    var els = $$("[data-split]"); els.forEach(function (e) { e.style.visibility = "hidden"; });
    var io = new IntersectionObserver(function (en) { en.forEach(function (e) { if (!e.isIntersecting) return; io.unobserve(e.target); playLines(e.target); }); }, { rootMargin: "0px 0px -2% 0px" });
    var btns = $$("main .button:not(.keep),main .showreel:not(.keep),.ph-s"); btns.forEach(function (b) { b.style.opacity = 0; b.style.translate = "0 1rem"; });
    var io2 = new IntersectionObserver(function (en) { en.forEach(function (e) { if (!e.isIntersecting) return; io2.unobserve(e.target); var b = e.target; b.style.transition = "padding .3s,opacity .9s .35s,translate .9s .35s cubic-bezier(.22,1,.36,1)"; b.style.opacity = 1; b.style.translate = "none"; setTimeout(function () { b.style.transition = ""; }, 1500); }); });
    onReady(function () { document.fonts.ready.then(function () { els.forEach(function (e) { io.observe(e); }); btns.forEach(function (b) { io2.observe(b); }); }); });
    setTimeout(function () { els.forEach(function (e) { if (e.getBoundingClientRect().bottom < 0) e.style.visibility = "visible"; }); }, 4000);
  })();
  (function () {
    var io = new IntersectionObserver(function (en) { en.forEach(function (e) { if (e.isIntersecting) e.target.classList.add("in"); else if (e.boundingClientRect.top > 0 && e.target.classList.contains("rv")) e.target.classList.remove("in"); }); }, { rootMargin: "0px 0px -15% 0px" });
    $$(".rvw").forEach(function (w) { var i = $(".rv", w); if (!i) return; new IntersectionObserver(function (en) { en.forEach(function (e) { if (e.isIntersecting) i.classList.add("in"); else if (e.boundingClientRect.top > 0) i.classList.remove("in"); }); }, { rootMargin: "0px 0px -15% 0px" }).observe(w); });
    $$(".fade").forEach(function (e) { io.observe(e); });
    $$("[data-par]").forEach(function (img) { var box = img.parentElement; tick.push(function () { if (isM() || !near(box)) return; img.style.transform = "translateY(" + (-10 * viewP(box)) + "%)"; }); });
  })();

  /* ---------- fill hover: leaves through the top ---------- */
  document.addEventListener("mouseout", function (e) {
    var b = e.target.closest && e.target.closest(".fill"); if (!b || b.contains(e.relatedTarget)) return;
    b.classList.add("is-leaving"); setTimeout(function () { b.classList.remove("is-leaving"); }, 300);
  });

  /* ---------- header, menus ---------- */
  (function () {
    var h = $(".header"); if (!h) return;
    var secs = $$("[data-header]"), cur = null;
    tick.push(function () {
      h.classList.toggle("sticky", SY > 20);
      var t = null, hh = h.offsetHeight;
      for (var i = 0; i < secs.length; i++) { var r = secs[i].getBoundingClientRect(); if (r.top <= hh && r.bottom > 0) t = secs[i].dataset.header; }
      if (t && t !== cur) { cur = t; h.classList.toggle("header-dark", t === "dark"); }
    });
    var nav = $(".hd-nav"), btn = $(".hd-nav .menu-btn"), list = $(".nav-list");
    function measure() { if (!list) return; var w = 0; $$(":scope>li", list).forEach(function (l) { w += l.offsetWidth; }); nav.style.setProperty("--nav-w", w + "px"); }
    btn && btn.addEventListener("click", function () { measure(); var o = nav.classList.toggle("menu-open"); $(".lb-t", btn).textContent = o ? "Close" : "Menu"; btn.setAttribute("aria-expanded", o); $$("li.open", list).forEach(function (l) { l.classList.remove("open"); }); });
    $$(".nav-list .has>button").forEach(function (b) { b.addEventListener("click", function () { var li = b.parentElement, o = li.classList.contains("open"); $$(".nav-list .open").forEach(function (l) { l.classList.remove("open"); }); li.classList.toggle("open", !o); }); });
    document.addEventListener("click", function (e) { if (!e.target.closest(".nav-list")) $$(".nav-list .open").forEach(function (l) { l.classList.remove("open"); }); if (!e.target.closest(".lang")) $$(".lang.open").forEach(function (l) { l.classList.remove("open"); }); });
    $$(".lang>button").forEach(function (b) { b.addEventListener("click", function () { b.parentElement.classList.toggle("open"); }); });
    $$(".lang a").forEach(function (a) { a.addEventListener("click", function (e) { e.preventDefault(); toast("Only the English demo copy is included"); }); });
    var mb = $(".hd-mob .menu-btn"), mm = $(".m-menu");
    mb && mb.addEventListener("click", function () { var o = mm.classList.toggle("open"); mb.classList.toggle("menu-open", o); document.body.classList.toggle("lock", o); $(".lb-t", mb).textContent = o ? "Close" : "Menu"; h.classList.toggle("menu-on", o); h.classList.toggle("header-dark", o || cur === "dark"); });
  })();

  /* ---------- flame: small offscreen painting, scaled up for softness ---------- */
  function Flame() {
    var cv = document.createElement("canvas"); cv.width = 140; cv.height = 140; var c = cv.getContext("2d");
    var T = []; for (var i = 0; i < 6; i++) T.push({ x: .24 + .52 * i / 5, s: .8 + (i * 37 % 10) / 11, p: i * 2.4, h: [.5, .86, .66, 1, .74, .46][i] });
    function tongue(x, b, w, h, sway, col) {
      c.fillStyle = col; c.beginPath(); c.moveTo(x - w, b);
      c.bezierCurveTo(x - w * 1.5, b - h * .34, x - w * .1 + sway * .7, b - h * .52, x + sway * 1.6, b - h);
      c.bezierCurveTo(x + w * .55 + sway * .5, b - h * .6, x + w * 1.5, b - h * .3, x + w, b);
      c.quadraticCurveTo(x, b + w * .35, x - w, b); c.fill();
    }
    this.paint = function (now, k) {
      var t = now / 1000; c.globalCompositeOperation = "source-over"; c.clearRect(0, 0, 140, 140); if (k <= .01) return cv;
      c.globalCompositeOperation = "lighter"; c.filter = "blur(2.6px)"; var b = 128;
      for (var i = 0; i < T.length; i++) {
        var f = T[i], n = .74 + .2 * Math.sin(t * 2.3 * f.s + f.p) + .12 * Math.sin(t * 5.1 * f.s + f.p * 3), h = 112 * f.h * n * k, x = (f.x + .02 * Math.sin(t * 1.3 + f.p)) * 140;
        var sw = Math.sin(t * 1.9 * f.s + f.p) * 7 * k + Math.sin(t * 4.3 + f.p) * 2;
        tongue(x, b, 15, h, sw, "rgba(214,58,10,.34)"); tongue(x, b, 10, h * .78, sw * .8, "rgba(255,128,24,.42)"); tongue(x, b, 5.4, h * .52, sw * .5, "rgba(255,226,160,.62)");
      }
      c.fillStyle = "rgba(80,120,255," + .28 * k + ")"; c.fillRect(26, b - 3, 88, 4); c.filter = "none"; return cv;
    };
  }

  /* ---------- turntable: re-projects the product photo onto its own cylinder ---------- */
  var G = { w: 633, h: 1400, cx: 316.5, R: 301, yT: 84, yB: 1306, sT: 15, sB: 30, door: [168, 500, 290, 432], pitch: 5.15, bands: [[354, 366, 400, 416], [962, 983, 1016, 1042]] };
  function Turntable(canvas, src, opt) {
    opt = opt || {};
    var img = new Image(), tex = document.createElement("canvas"), tc = tex.getContext("2d"), c = canvas.getContext("2d"), flame = new Flame(), ok = false, lastA = null;
    tex.width = G.w; tex.height = G.h; img.onload = function () { ok = true; }; img.src = src;
    var LIM = 70 * Math.PI / 180, PIT = G.pitch * 4 * Math.PI / 180;
    this.draw = function (angDeg, now, burn) {
      if (!ok) return;
      var cssW = canvas.clientWidth, dpr = Math.min(1.6, devicePixelRatio || 1), W = Math.round(cssW * dpr); if (!W) return;
      var H = Math.round(W * G.h / G.w); if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      if (!burn && lastA === angDeg) return; lastA = angDeg;
      tc.globalCompositeOperation = "source-over"; tc.clearRect(0, 0, G.w, G.h); tc.drawImage(img, 0, 0, G.w, G.h);
      if (burn) {
        var d = G.door, fl = flame.paint(now, burn); tc.save(); tc.globalCompositeOperation = "lighter";
        var gl = tc.createRadialGradient(d[0] + d[2] / 2, d[1] + d[3] * .86, 10, d[0] + d[2] / 2, d[1] + d[3] * .8, d[3] * .62); gl.addColorStop(0, "rgba(255,130,40," + .55 * burn + ")"); gl.addColorStop(1, "rgba(255,90,20,0)");
        tc.beginPath(); tc.moveTo(d[0] + 4, d[1] + d[3]); tc.lineTo(d[0] + 4, d[1] + d[2] * .48); tc.arc(d[0] + d[2] / 2, d[1] + d[2] * .48, d[2] / 2 - 4, Math.PI, 0); tc.lineTo(d[0] + d[2] - 4, d[1] + d[3]); tc.closePath(); tc.clip();
        tc.fillStyle = gl; tc.fillRect(d[0], d[1], d[2], d[3]); tc.drawImage(fl, d[0] + d[2] * .1, d[1] + d[3] * .36, d[2] * .8, d[3] * .66); tc.restore();
      }
      c.clearRect(0, 0, W, H); var k = W / G.w; c.imageSmoothingQuality = "high"; c.drawImage(tex, 0, 0, W, H);
      var th = angDeg * Math.PI / 180; if (Math.abs(th) < .0005) return;
      var x0 = Math.ceil((G.cx - G.R * .992) * k), x1 = Math.floor((G.cx + G.R * .992) * k);
      for (var x = x0; x <= x1; x++) {
        var u = (x / k - G.cx) / G.R, ph = Math.asin(u), ps = ph - th;
        if (ps > LIM) ps = LIM - ((LIM - ps) % PIT + PIT) % PIT; else if (ps < -LIM) ps = -LIM + ((ps + LIM) % PIT + PIT) % PIT;
        var sx = G.cx + G.R * Math.sin(ps), cd = Math.sqrt(1 - u * u), cs = Math.cos(ps);
        var st = G.yT + G.sT * cs, sb = G.yB + G.sB * cs, dt = G.yT + G.sT * cd, db = G.yB + G.sB * cd;
        c.drawImage(tex, sx, st, 1.2, sb - st, x, dt * k, 1.4, (db - dt) * k);
      }
      /* the steel bands are the same all the way round, so they stay put */
      G.bands.forEach(function (b) { c.save(); c.beginPath(); var xa = 0, xb = W, m = W / 2; c.moveTo(xa, b[0] * k); c.quadraticCurveTo(m, (2 * b[1] - b[0]) * k, xb, b[0] * k); c.lineTo(xb, b[2] * k); c.quadraticCurveTo(m, (2 * b[3] - b[2]) * k, xa, b[2] * k); c.closePath(); c.clip(); c.drawImage(tex, 0, 0, W, H); c.restore(); });
      var g = c.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, "rgba(8,16,18,.42)"); g.addColorStop(.12, "rgba(8,16,18,.08)"); g.addColorStop(.34, "rgba(255,240,230,.06)"); g.addColorStop(.7, "rgba(8,16,18,.03)"); g.addColorStop(1, "rgba(8,16,18,.46)");
      c.globalCompositeOperation = "source-atop"; c.globalAlpha = Math.min(1, Math.abs(angDeg) / 14); c.fillStyle = g; c.fillRect(x0, G.yT * k, x1 - x0, (G.yB + G.sB - G.yT) * k); c.globalAlpha = 1; c.globalCompositeOperation = "source-over";
    };
  }
  var ROOT = document.documentElement.dataset.root || "";

  /* home hero: rotation follows the pointer */
  (function () {
    var cv = $("#hero-turn"); if (!cv) return;
    var tt = new Turntable(cv, ROOT + "assets/img/round-front.webp"), a = 0, burn = 0, on = false, last = 0;
    onReady(function () { on = true; });
    tick.push(function (now) {
      var dt = Math.min(.1, (now - last) / 1000); last = now; if (SY > VH * 1.2) return;
      if (on) { a = lerp(a, isM() ? 0 : (mouse.x / innerWidth - .5) * 68, 1 - Math.exp(-dt / .45)); burn = lerp(burn, 1, 1 - Math.exp(-dt / 1.2)); }
      tt.draw(reduced ? 0 : a, now, reduced ? 1 : burn);
    });
  })();
  $$(".stack").forEach(function (s) { var h = s.firstElementChild; tick.push(function () { if (SY > VH * 1.3) return; h.style.transform = "translateY(" + (-20 * clamp(SY / VH, 0, 1)) + "%)"; }); });

  /* text blocks */
  (function () {
    var s = $(".text-blocks"); if (!s) return; var bg = $("img", s), a = $(".t1", s), b = $(".t2", s), st = 0, last = 0;
    function prep(el) { var ls = splitLines(el); ls.forEach(function (l) { l.className = ""; }); el.classList.add("swap"); }
    document.fonts.ready.then(function () { prep(a); prep(b); b.classList.add("sw-dn"); });
    addEventListener("resize", function () { prep(a); prep(b); });
    tick.push(function () {
      if (!near(s)) return; var p = pinP(s); bg.style.transform = "translateY(" + (-28 * viewP(s)) + "%)";
      var n = p > .02 && (p > last || st) ? (p < last - .0001 && p < .9 ? 0 : 1) : 0; if (p > .95) n = 1; if (p === last) n = st; last = p;
      if (n !== st) { st = n; a.classList.toggle("sw-up", !!n); b.classList.toggle("sw-dn", !n); }
    });
  })();

  /* horizontal hijack on mobile (info cards) */
  $$(".hj").forEach(function (w) {
    var tr = $(".info-r", w), cur = $(".pgr-c", w), bars = $$(".pgr-bar i", w), n = bars.length;
    function size() { if (isM()) w.style.setProperty("--hj", innerHeight + tr.scrollWidth - innerWidth + 32 + "px"); else tr.style.transform = ""; }
    size(); addEventListener("resize", size); addEventListener("load", size);
    tick.push(function () { if (!isM()) return; var p = pinP(w); tr.style.transform = "translateX(" + (-p * (tr.scrollWidth - innerWidth + 32)) + "px)"; var i = Math.round(p * (n - 1)); cur.textContent = pad(i + 1); bars.forEach(function (b, k) { b.classList.toggle("on", k <= i); }); });
  });

  /* ---------- scroll film: camera moves over photographs, dusk falls, the fire is lit ---------- */
  $$(".vb-pin").forEach(function (pin) {
    var cv = $("canvas", pin), c = cv.getContext("2d"), cards = $$(".vb-card", pin), shots = JSON.parse(pin.dataset.shots), flame = new Flame(), N = cards.length;
    shots.forEach(function (s) { s.img = new Image(); s.img.src = s.src; });
    var total = .5 + N * 11.5;
    function paint(s, p, now, alpha, gp) {
      var i = s.img; if (!i.complete || !i.naturalWidth) return; var W = cv.width, H = cv.height, e = E.inOut(p);
      var z = lerp(s.a[2], s.b[2], e), fx = lerp(s.a[0], s.b[0], e), fy = lerp(s.a[1], s.b[1], e);
      if (isM()) { fx = s.mx != null ? s.mx : fx; }
      var k = Math.max(W / i.naturalWidth, H / i.naturalHeight) * z, iw = i.naturalWidth * k, ih = i.naturalHeight * k;
      var x = clamp(W / 2 - fx * iw, W - iw, 0), y = clamp(H / 2 - fy * ih, H - ih, 0);
      c.globalAlpha = alpha; c.drawImage(i, x, y, iw, ih);
      if (s.night) {
        var nt = E.inOut(seg(gp, .12, .55)), d = s.door, dx = x + d[0] * iw, dy = y + d[1] * ih, dw = d[2] * iw, dh = d[3] * ih;
        c.globalCompositeOperation = "multiply"; c.fillStyle = "rgba(" + [lerp(255, 92, nt), lerp(255, 122, nt), lerp(255, 134, nt)].map(Math.round).join(",") + ",1)"; c.fillRect(0, 0, W, H);
        var fk = E.inOut(seg(gp, .2, .45)), fk2 = fk * (1 + .04 * Math.sin(now / 130) + .03 * Math.sin(now / 71));
        c.globalCompositeOperation = "lighter";
        if (fk > .01) {
          var g = c.createRadialGradient(dx + dw / 2, dy + dh * .8, 0, dx + dw / 2, dy + dh * .8, dw * 5); g.addColorStop(0, "rgba(255,120,40," + .42 * fk2 + ")"); g.addColorStop(.3, "rgba(220,90,30," + .16 * fk2 + ")"); g.addColorStop(1, "rgba(200,70,20,0)"); c.fillStyle = g; c.fillRect(0, 0, W, H);
          c.drawImage(flame.paint(now, fk), dx + dw * .08, dy + dh * .3, dw * .84, dh * .72);
        }
        c.globalCompositeOperation = "source-over";
      }
      c.globalAlpha = 1;
    }
    var idle = 0;
    scrub(pin, function () { return pinP(pin); }, function (p, now) {
      if (!near(pin)) return;
      var dpr = Math.min(1.5, devicePixelRatio || 1), W = Math.round(cv.clientWidth * dpr), H = Math.round(cv.clientHeight * dpr);
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      var f = p * shots.length, i = Math.min(shots.length - 1, Math.floor(f)), q = f - i;
      paint(shots[i], clamp(q, 0, 1), now, 1, p);
      if (i < shots.length - 1 && q > .72) paint(shots[i + 1], 0, now, seg(q, .72, .28), p);
      var t = p * total;
      cards.forEach(function (el, k) {
        var s = .5 + k * 11.5, u = (t - s) / 11.5, y = lerp(VH * .85, -VH * .85, u);
        var o = u <= 0 || u >= 1 ? 0 : Math.min(1, u * 11.5 / 1.25, (1 - u) * 11.5 / 1.25);
        el.style.transform = "translate(-50%,-50%) translateY(" + y.toFixed(1) + "px)"; el.style.opacity = o; el.style.visibility = o ? "visible" : "hidden";
      });
    }, isM() ? .3 : .18);
    var bar = $(".vbar", pin); if (bar) { var b = $("button", bar); b.addEventListener("click", function (e) { e.stopPropagation(); b.firstChild.textContent = bar.classList.toggle("open") ? "Close " : "Learn more "; }); document.addEventListener("click", function (e) { if (bar.classList.contains("open") && !bar.contains(e.target)) { bar.classList.remove("open"); b.firstChild.textContent = "Learn more "; } }); }
  });

  /* ---------- accordion with timed progress ---------- */
  $$(".acc").forEach(function (s) {
    var items = $$(".acc-i", s), imgs = $$(".acc-img>div", s), ics = $$(".acc-ic>div", s), ts = $$(".acc-t h5", s), ds = $$(".acc-t h3", s), D = 5000, cur = 0, left = D, vis = false, last = 0;
    function sw(list, i) { list.forEach(function (e, k) { if (k !== i && e.classList.contains("on")) { e.classList.remove("on"); e.classList.add("was"); setTimeout(function () { e.classList.remove("was"); }, 1400); } }); list[i] && list[i].classList.add("on"); }
    function act(i) {
      cur = i; left = D; items.forEach(function (e, k) { e.classList.toggle("on", k === i); $("i", e).style.width = 0; e.setAttribute("aria-expanded", k === i); });
      sw(imgs, i); sw(ics, (i + 1) % items.length); [ts, ds].forEach(function (l) { l.forEach(function (e, k) { e.classList.toggle("on", k === i); }); if (l[i] && !reduced) playLines(l[i]); });
    }
    items.forEach(function (e, i) { e.addEventListener("click", function () { act(i); }); });
    new IntersectionObserver(function (e) { vis = e[0].isIntersecting; }, { threshold: .4 }).observe(s);
    tick.push(function (now) { var dt = now - last; last = now; if (!vis || dt > 200) return; left -= dt; $("i", items[cur]).style.width = clamp(100 * (1 - left / D), 0, 100) + "%"; if (left <= 0) act((cur + 1) % items.length); });
  });

  /* ---------- certificates on touch ---------- */
  $$(".cert-b,.po-k").forEach(function (b) { b.addEventListener("click", function () { var o = b.classList.contains("on"); $$(".on", b.parentElement).forEach(function (x) { if (x.parentElement === b.parentElement) x.classList.remove("on"); }); if (matchMedia("(hover:none)").matches) b.classList.toggle("on", !o); }); });
  $$(".cert-t").forEach(function (t) { var th = $(".cert-sb i", t.parentElement); t.addEventListener("scroll", function () { th.style.transform = "translateX(" + 300 * t.scrollLeft / Math.max(1, t.scrollWidth - t.clientWidth) + "%)"; }); });

  /* ---------- testimonials ---------- */
  $$(".tst").forEach(function (s) {
    var tr = $(".tst-tr", s), sl = $$(".tst-s", s), th = $$(".tst-th button", s), num = $(".tst-cn", s), area = $(".tst-c", s), cu = $(".tst-cur", s), lab = $("span", cu), ci = $("circle", cu), C = 2 * Math.PI * 38, i = 0, D = 12000, left = D, vis = false, last = 0, dir = 1, cx = 0, cy = 0, mx = 0, my = 0;
    ci.style.strokeDasharray = C;
    function go(n, quiet) {
      i = (n + sl.length) % sl.length; left = D; tr.style.transform = "translateX(calc(" + (-100 * i) + "% - " + 1.5 * i + "rem))"; num.textContent = pad(i + 1);
      th.forEach(function (b, k) { b.classList.toggle("on", k === i); }); var m = clamp(i - 3, 0, th.length - 4); th[0].parentElement.style.transform = "translateY(" + (-m * (th[0].offsetHeight + 24)) + "px)";
      if (!quiet && !reduced && innerWidth > 1024) $$("h3,h5", $(".tx", sl[i])).forEach(playLines);
    }
    th.forEach(function (b, k) { b.addEventListener("click", function () { go(k); }); });
    area.addEventListener("mousemove", function (e) { var r = area.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; cu.style.opacity = 1; dir = mx > r.width / 2 ? 1 : -1; lab.textContent = dir > 0 ? "NEXT" : "BACK"; });
    area.addEventListener("mouseleave", function () { cu.style.opacity = 0; });
    area.addEventListener("click", function () { if (innerWidth > 1024) go(i + dir); });
    var sx = 0; area.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; }, { passive: true }); area.addEventListener("touchend", function (e) { var d = e.changedTouches[0].clientX - sx; if (Math.abs(d) > 40) go(i + (d < 0 ? 1 : -1)); });
    new IntersectionObserver(function (e) { vis = e[0].isIntersecting; if (!vis) left = D; }, { threshold: .3 }).observe(s);
    tick.push(function (now) { var dt = now - last; last = now; if (!vis) return; cx = lerp(cx, mx, .12); cy = lerp(cy, my, .12); cu.style.transform = "translate(" + cx + "px," + cy + "px)"; if (dt < 200) left -= dt; ci.style.strokeDashoffset = C * (left / D); if (left <= 0) go(i + 1); });
    go(0, true);
  });

  /* ---------- CTA: words part, card rises ---------- */
  $$(".ctaw").forEach(function (s) {
    var st = $(".ctaw-s", s), bg = $("img", st), ws = $$(".ctaw-w h2", s), card = $(".ctaw-c", s), dx = [0, 0], B = 3.889, T = B / 2.44;
    function size() {
      ws.forEach(function (w) { w.style.transform = "none"; });
      if (isM()) { dx = ws.map(function (w, k) { return (k ? 1 : -1) * (innerWidth / 2 + w.offsetWidth / 2 + 40); }); return; }
      ws.forEach(function (w) { w.style.fontSize = T + "vw"; }); var P = parseFloat(getComputedStyle(document.documentElement).fontSize) * 1.5;
      dx = [P - ws[0].getBoundingClientRect().left, st.clientWidth - P - ws[1].getBoundingClientRect().right]; ws.forEach(function (w) { w.style.fontSize = ""; });
    }
    document.fonts.ready.then(size); addEventListener("resize", size);
    tick.push(function () { if (near(s)) bg.style.transform = "translateY(" + lerp(18, -18, viewP(s)) + "%)"; });
    scrub(s, function () { return pinP(s); }, function (p) {
      var m = isM(), t = p * (m ? 1.6 : 1.6), a = clamp(t, 0, 1), q = m ? E.out(seg(t, .5, .8)) : seg(t, .3, .8);
      ws.forEach(function (w, k) { if (!m) w.style.fontSize = lerp(B, T, a) + "vw"; w.style.transform = "translateX(" + dx[k] * a + "px)"; });
      card.style.transform = "translate(-50%," + lerp(160, m ? -45 : -43, q) + "%)";
    }, .28);
  });

  /* ---------- footer image ---------- */
  (function () {
    var f = $(".ft-img"); if (!f) return; var inn = $(".ft-img__in", f), img = $("img", f), x = 0, y = 0;
    scrub(f, function () { var r = f.getBoundingClientRect(); return clamp((VH - r.top) / r.height, 0, 1); }, function (p) {
      inn.style.transform = "translateY(" + (-40 * (1 - p)) + "%)"; f.style.setProperty("--o", (.9 * (1 - p)).toFixed(3));
      x = lerp(x, mouse.x / innerWidth * -2.5, .05); y = lerp(y, mouse.y / innerHeight * -5, .05); img.style.left = x + "%"; img.style.top = y + "%";
    }, .25);
    $(".to-top").addEventListener("click", function (e) { e.preventDefault(); scrollToY(0); });
  })();

  /* ---------- feature pair ---------- */
  $$(".feat:not(.single)").forEach(function (f) {
    var pin = $(".feat-pin", f), it = $$(".feat-i", f), t1 = $(".feat-l", it[0]), t2 = $(".feat-l", it[1]), im = $(".feat-r img", it[1]), st = 0, busy = false;
    function swap(n) { if (st === n || busy) return; st = n; busy = true; it[0].style.pointerEvents = n ? "none" : "auto"; it[1].style.pointerEvents = n ? "auto" : "none"; (n ? t1 : t2).style.opacity = 0; setTimeout(function () { (n ? t2 : t1).style.opacity = 1; setTimeout(function () { busy = false; }, 300); }, 300); }
    scrub(pin, function () { return pinP(pin); }, function (p) { if (isM()) return; var q = clamp(p * 1.3, 0, 1); im.style.clipPath = "inset(" + (100 * (1 - q)) + "% 0 0 0)"; im.style.transform = "scale(" + lerp(1.1, 1, q) + ")"; swap(p >= .5 ? 1 : 0); }, .4);
  });

  /* ---------- material panels + component list ---------- */
  function componentSteps(root) {
    var tr = $(".cmpn-tr", root), items = $$(".cp", root), cv = $(".cmpn-c canvas", root), tt = cv ? new Turntable(cv, ROOT + "assets/img/round-front.webp") : null, pc = $(".cmpn-pg b", root), bars = $$(".cmpn-pg i", root);
    function style(el, t) { if (isM()) return; var v = innerWidth / 100; el.style.width = lerp(70, 90, t) + "%"; var i = $("img", el); i.style.width = i.style.height = lerp(5.556, 6.944, t) * v + "px"; $("h4", el).style.fontSize = lerp(.972, 1.667, t) * v + "px"; $("p", el).style.fontSize = lerp(.972, 1.111, t) * v + "px"; }
    return function (t, now) { /* t: 0..1 over the whole list */
      var n = items.length, pos = t * (n - .5), base = Math.floor(pos), fr = pos - base, idx = clamp(base + E.inOut(seg(fr, .5, .5)), 0, n - 1);
      items.forEach(function (el, k) { style(el, clamp(1 - Math.abs(idx - k), 0, 1)); });
      if (isM()) { tr.style.transform = "translateX(" + (-idx * (items[0].offsetWidth + 16)) + "px)"; var q = Math.round(idx); if (pc) pc.textContent = pad(q + 1); bars.forEach(function (b, k) { b.classList.toggle("on", k <= q); }); }
      else { var a = Math.floor(idx), y = 0; for (var k = 0; k < a; k++) y += items[k].offsetHeight; y += (items[a] ? items[a].offsetHeight : 0) * (idx - a); tr.style.transform = "translateY(" + (innerHeight / 2 - items[0].offsetHeight / 2 - y) + "px)"; }
      if (tt) tt.draw(lerp(-32, 32, t), now, 1);
    };
  }
  $$(".ab-pin").forEach(function (pin) {
    var im = $(".ab-im", pin), ab = $(".ab", pin), cols = $$(".ab-c", pin), comp = $(".cmpn", pin), steps = comp ? componentSteps(comp) : null, n = cols.length;
    scrub(pin, function () { return pinP(pin); }, function (p, now) {
      var inEnd = 3 + (n - 1) * (.4 + .4), stuck = inEnd + (comp ? 0 : .8), total = comp ? stuck + 3.8 + 8.5 : stuck, t = p * total;
      im.style.opacity = lerp(1, .3, seg(t, 0, 1)) * (comp ? 1 - seg(t, stuck + .3, .5) : 1);
      cols.forEach(function (c, i) { var a = E.out(seg(t, i * .8, 3)), b = comp ? E.inOut(seg(t, stuck + .5 + i * .3, 3)) : 0; c.style.transform = "translateY(" + (120 * (1 - a) - 110 * b) + "%)"; });
      if (comp) { var k = E.inOut(seg(t, stuck + .3, 3)); ab.style.background = t > stuck ? "transparent" : ""; comp.style.transform = "translateY(" + 100 * (1 - k) + "%)"; comp.style.zIndex = t > stuck + 1.8 ? 20 : 1; pin.dataset.header = k > .93 ? "dark" : "light"; steps(seg(t, stuck + 3.8, 8.5), now); }
    }, .12);
  });
  $$(".solo-c").forEach(function (pin) { var steps = componentSteps($(".cmpn", pin)); scrub(pin, function () { return pinP(pin); }, function (p, now) { steps(clamp(p * 1.06, 0, 1), now); }, .12); });

  /* ---------- FAQ ---------- */
  var fqs = $$(".fq");
  fqs.forEach(function (f) { f.addEventListener("click", function (e) { if (e.target.closest("a")) return; var o = f.classList.contains("on"); fqs.forEach(function (x) { x.classList.remove("on"); $(".fq-t", x).style.height = 0; $("button", x).setAttribute("aria-expanded", "false"); }); if (!o) { f.classList.add("on"); var t = $(".fq-t", f); t.style.height = t.scrollHeight + "px"; $("button", f).setAttribute("aria-expanded", "true"); } }); });

  /* ---------- draggable tracks ---------- */
  function slider(view, track, count, stepW, onChange, maxFn) {
    var i = 0, x0 = 0, dx = 0, down = false, moved = false;
    function max() { return maxFn ? maxFn() : count - 1; }
    function set(n) { i = clamp(n, 0, max()); track.style.transform = "translateX(" + (-Math.min(i * stepW(), Math.max(0, track.scrollWidth - view.clientWidth))) + "px)"; onChange && onChange(i); }
    view.addEventListener("pointerdown", function (e) { if (e.button) return; down = true; moved = false; x0 = e.clientX; dx = 0; });
    addEventListener("pointermove", function (e) { if (!down) return; dx = e.clientX - x0; if (Math.abs(dx) > 6) { moved = true; track.classList.add("drag"); track.style.transform = "translateX(" + (-Math.min(i * stepW(), Math.max(0, track.scrollWidth - view.clientWidth)) + dx) + "px)"; } });
    function up() { if (!down) return; down = false; track.classList.remove("drag"); if (moved) set(i + (Math.abs(dx) > 50 ? (dx < 0 ? 1 : -1) * Math.max(1, Math.round(Math.abs(dx) / stepW())) : 0)); }
    addEventListener("pointerup", up); addEventListener("pointercancel", up);
    view.addEventListener("click", function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
    view.addEventListener("dragstart", function (e) { e.preventDefault(); });
    addEventListener("resize", function () { set(i); });
    return set;
  }
  $$(".gal").forEach(function (g) {
    var v = $(".gal-m", g), tr = $(".gal-tr", g), th = $$(".gal-t button", g), c = $(".pg-c", g), bars = $$(".pgr-bar i", g);
    var set = slider(v, tr, th.length, function () { return v.clientWidth; }, function (i) { th.forEach(function (t, k) { t.classList.toggle("on", k === i); }); c.textContent = pad(i + 1); bars.forEach(function (b, k) { b.classList.toggle("on", k <= i); }); });
    th.forEach(function (t, k) { t.addEventListener("click", function () { set(k); }); });
    $$("a", tr).forEach(function (a, k, all) { a.addEventListener("click", function (e) { e.preventDefault(); lightbox(all.map(function (x) { return x.getAttribute("href"); }), k); }); });
  });
  $$(".ps").forEach(function (p) { var v = $(".ps-v", p), tr = $(".ps-tr", p), cards = $$(".pc", p), c = $(".pg-c", p), bars = $$(".pgr-bar i", p); slider(v, tr, cards.length, function () { return cards[0].offsetWidth + 24; }, function (i) { c.textContent = pad(i + 1); bars.forEach(function (b, k) { b.classList.toggle("on", k <= i); }); }); });
  $$(".po-c").forEach(function (v) { var tr = $(".po-tr", v); if (!isM()) slider(v, tr, 6, function () { return $(".po-k", v).offsetWidth; }, null, function () { return 2; }); });

  /* ---------- overlays ---------- */
  function openOv(o) { o.classList.add("open"); document.body.classList.add("lock"); }
  function closeOv(o) { o.classList.remove("open"); if (!$(".ov.open") && !$(".drawer.open")) document.body.classList.remove("lock"); $$("video", o).forEach(function (v) { v.pause(); }); }
  document.addEventListener("click", function (e) {
    var o = e.target.closest("[data-open]"); if (o) { e.preventDefault(); var t = $(o.dataset.open); t && openOv(t); return; }
    if (e.target.classList && e.target.classList.contains("ov")) closeOv(e.target);
    var x = e.target.closest("[data-close]"); if (x) closeOv(x.closest(".ov"));
    var v = e.target.closest("[data-video]"); if (v) { e.preventDefault(); lightbox([v.dataset.video], 0, true); }
    var im = e.target.closest("[data-zoom]"); if (im) lightbox([im.dataset.zoom], 0);
  });
  addEventListener("keydown", function (e) { if (e.key === "Escape") { $$(".ov.open").forEach(closeOv); closeCart(); } });
  var lb;
  function lightbox(list, i, video) {
    if (!lb) { lb = document.createElement("div"); lb.className = "ov lb"; document.body.append(lb); }
    function show() {
      lb.innerHTML = (video ? '<video src="' + list[i] + '" controls autoplay playsinline loop></video>' : '<img src="' + list[i] + '" alt="">') + '<button class="x" data-close aria-label="Close">' + X + "</button>" + (list.length > 1 ? '<button class="pv" aria-label="Previous">&#8592;</button><button class="nx" aria-label="Next">&#8594;</button>' : "");
      if (list.length > 1) { $(".pv", lb).onclick = function () { i = (i - 1 + list.length) % list.length; show(); }; $(".nx", lb).onclick = function () { i = (i + 1) % list.length; show(); }; }
    }
    show(); openOv(lb);
  }
  $$(".pp").forEach(function (p) { var tb = $$(".pp-tb button", p), pn = $$(".pp-pn", p); tb.forEach(function (b, i) { b.addEventListener("click", function () { tb.forEach(function (x, k) { x.classList.toggle("on", k === i); pn[k].classList.toggle("on", k === i); }); }); }); });
  $$(".po-t").forEach(function (t) { var b = $$("button", t), p = $$(".po-p", t.parentElement); b.forEach(function (x, i) { x.addEventListener("click", function () { b.forEach(function (y, k) { y.classList.toggle("on", k === i); p[k].hidden = k !== i; }); }); }); });

  /* 3D viewer: drag to turn */
  $$(".v3").forEach(function (o) {
    var st = $(".v3-st", o), cv = $("canvas", o), tt = new Turntable(cv, ROOT + "assets/img/round-front.webp"), a = 0, to = 0, down = false, x = 0, touched = false;
    st.addEventListener("pointerdown", function (e) { down = true; touched = true; x = e.clientX; });
    addEventListener("pointermove", function (e) { if (!down) return; to = clamp(to + (e.clientX - x) * .25, -38, 38); x = e.clientX; }); addEventListener("pointerup", function () { down = false; });
    tick.push(function (now) { if (!o.classList.contains("open")) return; if (!touched) to = Math.sin(now / 1800) * 26; a = lerp(a, to, .09); tt.draw(a, now, 1); });
    $$(".v3-o", o).forEach(function (d) { $("button", d).addEventListener("click", function () { var on = d.classList.contains("on"); $$(".v3-o", o).forEach(function (z) { z.classList.remove("on"); }); d.classList.toggle("on", !on); }); });
  });

  /* ---------- delivery / returns slides ---------- */
  $$(".pdg").forEach(function (s) {
    var it = $$(".pdg-i", s), n = it.length;
    scrub(s, function () { return pinP(s); }, function (p) { var f = p * n, i = Math.min(n - 1, Math.floor(f)), q = clamp(f - i, 0, 1); it.forEach(function (e, k) { e.classList.toggle("on", k === i); }); var e = it[i], t = $(".pdg-x>div", e); t.style.transform = "translateY(" + lerp(e.querySelector(".pdg-x").clientHeight * .3, -(t.scrollHeight - e.querySelector(".pdg-x").clientHeight * .7), seg(q, .1, .8)) + "px)"; $("img", e).style.transform = "scale(" + lerp(1.06, 1, q) + ")"; }, .3);
    $$("[data-pdg]", s).forEach(function (a) { a.addEventListener("click", function (e) { e.preventDefault(); var r = s.getBoundingClientRect(); scrollToY(scrollY + r.top + (+a.dataset.pdg / n + .04) * (r.height - innerHeight)); }); });
  });
  (function () { var s = $(".ctas>img"); if (s) tick.push(function () { if (near(s.parentElement)) s.style.transform = "translateY(" + lerp(-10, 10, viewP(s.parentElement)) + "%)"; }); var f = $(".fs-im img"); if (f) { f.style.scale = 1.12; tick.push(function () { if (near(f.parentElement)) f.style.transform = "translateY(" + lerp(-5, 5, viewP(f.parentElement)) + "%)"; }); } })();

  /* ---------- blog load more ---------- */
  (function () { var b = $(".more"); if (!b) return; b.addEventListener("click", function () { b.firstElementChild.textContent = "Loading…"; setTimeout(function () { $$(".bl-c[hidden]").forEach(function (c, i) { c.hidden = false; c.classList.add("fade"); setTimeout(function () { c.classList.add("in"); }, 60 + i * 110); }); b.remove(); }, 500); }); })();

  /* ---------- cart ---------- */
  var drawer = $(".drawer"), cart = store.get("cart") || [];
  var ADD = { id: "snuffer", name: "Brass flame snuffer", price: 38, img: "assets/img/kit-2.jpg", tag: "Goes well with", ref: "Accessories" };
  var money = function (n) { return "€" + n.toLocaleString("en-US"); };
  function itemsHTML() {
    return cart.map(function (c, i) { return '<div class="ci"><img src="' + ROOT + c.img + '" alt=""><div><div class="ci__h"><h6 class="up">' + c.tag + '</h6><button data-rm="' + i + '" aria-label="Remove ' + c.name + '">' + X.replace("<svg", '<svg width="11"') + "</button></div><h4>" + c.name + '</h4></div><div class="ci__b"><div class="qty"><button data-q="' + i + ',-1" aria-label="Less">−</button><span>' + c.qty + '</span><button data-q="' + i + ',1" aria-label="More">+</button></div><strong>' + money(c.price * c.qty) + "</strong></div></div>"; }).join("");
  }
  var total = function () { return cart.reduce(function (s, c) { return s + c.price * c.qty; }, 0); };
  function render() {
    store.set("cart", cart); var n = cart.reduce(function (s, c) { return s + c.qty; }, 0); $$(".count").forEach(function (e) { e.textContent = n; });
    if (drawer) {
      $(".drawer__m", drawer).innerHTML = cart.length ? itemsHTML() : '<div class="drawer__e"><span>Y<i class="flame-o"></i>ur cart</span><span>is still empty</span></div>';
      var hasAdd = cart.some(function (c) { return c.id === ADD.id; });
      $(".drawer__f", drawer).innerHTML = cart.length ? (hasAdd ? "" : '<div class="addons"><h6 class="up">Complete the evening</h6><div class="addon"><img src="' + ROOT + ADD.img + '" alt=""><p>' + ADD.name + "<br><strong>" + money(ADD.price) + "</strong></p><button data-addon>Add</button></div></div>") + '<div class="drawer__tot"><span>Total</span><span>' + money(total()) + '</span></div><div class="button full b-dark keep"><button data-checkout>Checkout</button></div><div class="button full keep" style="margin-top:.5rem"><a href="' + ROOT + 'cart.html">View cart</a></div>' : '<div class="button full keep"><a href="' + ROOT + 'hearths.html">See the hearths</a></div>';
    }
    var pg = $("#cart-page"); if (pg) pg.innerHTML = cart.length ? '<div class="plain" style="padding-left:0;padding-right:0"><div style="max-width:none"><h1>Your cart</h1><div class="cartp"><div>' + itemsHTML() + '</div><div><div class="drawer__tot"><span>Total</span><span>' + money(total()) + '</span></div><p class="smaller" style="margin:0 0 1.5rem">VAT included. Delivery is calculated at the next step.</p><div class="button full b-dark keep"><button data-checkout>Checkout</button></div></div></div></div></div>' : '<div class="empty"><div class="hl">Y<i class="flame-o"></i>ur cart is empty</div><div class="button keep"><a href="hearths.html">See the hearths</a></div></div>';
  }
  function openCart() { if (!drawer) return; drawer.classList.add("open"); document.body.classList.add("lock"); }
  function closeCart() { if (!drawer) return; drawer.classList.remove("open"); if (!$(".ov.open")) document.body.classList.remove("lock"); }
  function addItem(d) { var f = cart.filter(function (c) { return c.id === d.id; })[0]; if (f) f.qty++; else cart.push({ id: d.id, name: d.name, price: d.price, img: d.img, tag: d.ref || d.tag || "", qty: 1 }); render(); }
  document.addEventListener("click", function (e) {
    var t = e.target, a = t.closest("[data-add]"); if (a) { var b = a; b.textContent = "Adding…"; setTimeout(function () { b.textContent = "Add to cart"; addItem(JSON.parse(b.dataset.add)); $$(".ov.open").forEach(closeOv); openCart(); }, 350); return; }
    if (t.closest("[data-cart]")) { e.preventDefault(); openCart(); } if (t.closest("[data-cart-close]")) closeCart();
    if (t.closest("[data-addon]")) addItem(ADD);
    var r = t.closest("[data-rm]"); if (r) { cart.splice(+r.dataset.rm, 1); render(); }
    var q = t.closest("[data-q]"); if (q) { var z = q.dataset.q.split(","); cart[z[0]].qty += +z[1]; if (cart[z[0]].qty < 1) cart.splice(z[0], 1); render(); }
    if (t.closest("[data-checkout]")) toast("Checkout is not connected in this demo");
  });
  render();

  /* ---------- toast, forms ---------- */
  var tEl, tT;
  function toast(m) { if (!tEl) { tEl = document.createElement("div"); tEl.className = "toast"; tEl.setAttribute("role", "status"); document.body.append(tEl); void tEl.offsetHeight; } tEl.textContent = m; tEl.classList.add("on"); clearTimeout(tT); tT = setTimeout(function () { tEl.classList.remove("on"); }, 2600); }
  var mailOk = function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); };
  $$(".sub-form").forEach(function (f) { f.addEventListener("submit", function (e) { e.preventDefault(); var i = $("input", f), m = f.nextElementSibling; if (!mailOk(i.value)) { m.textContent = "Please enter a valid email"; i.focus(); return; } m.textContent = "Thank you — you are on the list"; f.reset(); }); });
  $$(".fm").forEach(function (f) { f.noValidate = true; f.addEventListener("submit", function (e) { e.preventDefault(); var bad = null; $$("[required]", f).forEach(function (i) { var b = i.type === "checkbox" ? !i.checked : i.type === "email" ? !mailOk(i.value) : !i.value.trim(); i.closest("label").classList.toggle("bad", b); if (b && !bad) bad = i; }); $(".msg", f).textContent = bad ? "Please complete the highlighted fields" : ""; if (bad) { bad.focus(); return; } leave("thank-you.html"); }); });

  /* ---------- cookie alert ---------- */
  (function () {
    var c = $(".cookie"); if (!c) return; if (store.get("cookies") || /nocookie/.test(location.search)) { c.remove(); return; }
    function done(v) { store.set("cookies", v); c.classList.add("off"); setTimeout(function () { c.remove(); }, 600); }
    c.addEventListener("click", function (e) { var b = e.target.closest("[data-ck]"); if (!b) return; var k = b.dataset.ck; if (k === "manage") { if (c.classList.toggle("man")) { b.textContent = "Save settings"; b.dataset.ck = "save"; } } else if (k === "save") done({ custom: $$("input", c).map(function (i) { return i.checked; }) }); else done({ all: k === "accept" }); });
  })();

  /* ---------- gift wheel ---------- */
  (function () {
    var o = $("#wheel"); if (!o || store.get("wheel") || navigator.webdriver) return;
    setTimeout(function () { if (!$(".ov.open") && !$(".drawer.open") && !$(".m-menu.open")) openOv(o); store.set("wheel", 1); }, 30000);
  })();
  (function () {
    var o = $("#wheel"); if (!o) return; var f = $("form", o), svg = $("svg.w", o), P = ["€150 off", "€100 off", "€50 off", "Secret gift", "€150 off", "€100 off", "€50 off", "Secret gift"];
    f.addEventListener("submit", function (e) { e.preventDefault(); var i = $("input", f); if (!mailOk(i.value)) { i.focus(); i.style.borderColor = "var(--accent)"; return; } var k = Math.floor(Math.random() * 8); svg.style.transform = "rotate(" + (360 * 5 - k * 45) + "deg)"; $("button", f).disabled = true; setTimeout(function () { $("h3", o).textContent = "You won: " + P[k]; $("p", o).textContent = "Use code EMBER-" + (100 + k * 37) + " at checkout (demo code)."; f.hidden = true; }, reduced ? 100 : 4400); });
  })();

  /* ---------- page transitions ---------- */
  function leave(href) { if (reduced) { location.href = href; return; } document.body.classList.add("leaving"); setTimeout(function () { location.href = href; }, 550); }
  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest("a"); if (!a) return; var h = a.getAttribute("href") || "";
    if (h.charAt(0) === "#") { if (h.length > 1) { var t = document.getElementById(h.slice(1)); if (t) { e.preventDefault(); scrollToY(scrollY + t.getBoundingClientRect().top); } } else e.preventDefault(); return; }
    if (/^(mailto|tel|https?|file):/.test(h) || a.target === "_blank" || a.hasAttribute("download") || !/\.html/.test(h)) return;
    e.preventDefault(); closeCart(); leave(h);
  });
  addEventListener("pageshow", function (e) { if (e.persisted) document.body.classList.remove("leaving"); });
})();
