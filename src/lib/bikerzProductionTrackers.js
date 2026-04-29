/**
 * Third-party marketing/analytics (GA4, Clarity, Meta, TikTok, GHL) for production hostname only.
 * Gated in React: must not be called for admin/staff — see ProductionThirdPartyTrackers.
 */
let bikerzProdTrackersScheduled = false;

/**
 * Injects the same script behavior as the legacy index.html (deferred/idle, interaction triggers).
 * Idempotent; safe to call from React with Strict Mode.
 */
export function installBikerzProductionTrackers() {
  if (typeof window === "undefined") return;
  if (window.location.hostname !== "academy.bikerz.com") return;
  if (bikerzProdTrackersScheduled) return;
  bikerzProdTrackersScheduled = true;

  // —— Google Analytics 4 ——
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  (window.requestIdleCallback || function (cb) {
    setTimeout(cb, 3000);
  })(function () {
    var s = document.createElement("script");
    s.src = "https://www.googletagmanager.com/gtag/js?id=G-DDQSM0LN66";
    s.async = true;
    s.crossOrigin = "anonymous";
    document.head.appendChild(s);
    window.gtag("js", new Date());
    window.gtag("config", "G-DDQSM0LN66", { send_page_view: true });
  });

  // —— Microsoft Clarity ——
  (function () {
    var loaded = false;
    function loadClarity() {
      if (loaded) return;
      loaded = true;
      (function (c, l, a, r, i, t, y) {
        c[a] =
          c[a] ||
          function () {
            (c[a].q = c[a].q || []).push(arguments);
          };
        t = l.createElement(r);
        t.async = 1;
        t.crossOrigin = "anonymous";
        t.src = "https://www.clarity.ms/tag/" + i;
        y = l.getElementsByTagName(r)[0];
        y.parentNode.insertBefore(t, y);
      })(window, document, "clarity", "script", "wen6hla6r7");
    }
    var events = ["scroll", "mousemove", "touchstart", "keydown", "click"];
    for (var ei = 0; ei < events.length; ei++) {
      window.addEventListener(events[ei], loadClarity, { once: true, passive: true });
    }
    setTimeout(loadClarity, 4000);
  })();

  // —— Meta Pixel (two IDs) ——
  (function () {
    var loaded = false;
    function loadPixel() {
      if (loaded) return;
      loaded = true;
      !(function (f, b, e, v, n, t, s) {
        if (f.fbq) return;
        n = f.fbq = function () {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        };
        if (!f._fbq) f._fbq = n;
        n.push = n;
        n.loaded = !0;
        n.version = "2.0";
        n.queue = [];
        t = b.createElement(e);
        t.async = !0;
        t.crossOrigin = "anonymous";
        t.src = v;
        s = b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t, s);
      })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
      if (typeof window.fbq === "function") {
        window.fbq("init", "2072521093528197");
        window.fbq("init", "299672655754419");
        window.fbq("track", "PageView");
      }
    }
    var ev2 = ["scroll", "mousemove", "touchstart", "keydown"];
    for (var j = 0; j < ev2.length; j++) {
      window.addEventListener(ev2[j], loadPixel, { once: true, passive: true });
    }
    setTimeout(loadPixel, 3000);
  })();

  // —— TikTok Pixel + GHL external ——
  (function () {
    var _ric = window.requestIdleCallback || function (cb) {
      setTimeout(cb, 200);
    };
    _ric(function () {
      !(function (w, d, t) {
        w.TiktokAnalyticsObject = t;
        var ttq = (w[t] = w[t] || []);
        ttq.methods = [
          "page",
          "track",
          "identify",
          "instances",
          "debug",
          "on",
          "off",
          "once",
          "ready",
          "alias",
          "group",
          "enableCookie",
          "disableCookie",
          "holdConsent",
          "revokeConsent",
          "grantConsent",
        ];
        ttq.setAndDefer = function (a, e) {
          a[e] = function () {
            a.push([e].concat(Array.prototype.slice.call(arguments, 0)));
          };
        };
        for (var i = 0; i < ttq.methods.length; i++) {
          ttq.setAndDefer(ttq, ttq.methods[i]);
        }
        ttq.instance = function (id) {
          var e = ttq._i[id] || [];
          for (var n = 0; n < ttq.methods.length; n++) {
            ttq.setAndDefer(e, ttq.methods[n]);
          }
          return e;
        };
        ttq.load = function (e, n) {
          var r = "https://analytics.tiktok.com/i18n/pixel/events.js";
          ttq._i = ttq._i || {};
          ttq._i[e] = [];
          ttq._i[e]._u = r;
          ttq._t = ttq._t || {};
          ttq._t[e] = +new Date();
          ttq._o = ttq._o || {};
          ttq._o[e] = n || {};
          n = d.createElement("script");
          n.type = "text/javascript";
          n.async = !0;
          n.crossOrigin = "anonymous";
          n.src = r + "?sdkid=" + e + "&lib=" + t;
          var el = d.getElementsByTagName("script")[0];
          el.parentNode.insertBefore(n, el);
        };
        ttq.load("D6PBJ5JC77UCTG8FFUR0");
        ttq.page();
      })(window, document, "ttq");
      var g = document.createElement("script");
      g.defer = true;
      g.crossOrigin = "anonymous";
      g.src = "https://link.msgsndr.com/js/external-tracking.js";
      g.setAttribute("data-tracking-id", "tk_2b31b1d54835429da32d80af2da1a552");
      document.head.appendChild(g);
    });
  })();
}
