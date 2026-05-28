/**
 * live-header.js — makes the masthead location / weather / date chips live.
 *
 * - The date updates immediately on every page (pure client-side, always works).
 * - The location + temperature + condition + icon are filled in from the
 *   /api/local Cloudflare Pages Function. If that call fails (e.g. opening the
 *   file locally without `wrangler`), the existing static text is left alone.
 *
 * Works with both header markups used across the site:
 *   1) <div class="weather-chip"><svg>…</svg><span>Pasadena · 74°F · Clear</span></div>
 *   2) <div class="weather-chip">Pasadena · 74°F · Clear</div>
 */
(function () {
  'use strict';

  /* ---------- Date (no network needed) -------------------------------- */

  function formatDate(d) {
    try {
      return d.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (e) {
      return d.toDateString();
    }
  }

  function updateDate() {
    var now = new Date();
    var els = document.querySelectorAll('.date-chip');
    for (var i = 0; i < els.length; i++) {
      els[i].textContent = formatDate(now);
    }
  }

  /* ---------- Weather icons (match the existing stroke style) ---------- */

  var ICONS = {
    sun:
      '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
    'cloud-sun':
      '<path d="M12 2v2M4.9 4.9l1.4 1.4M2 12h2M19.1 4.9l-1.4 1.4"/><circle cx="9" cy="9" r="3"/><path d="M16 18H8a4 4 0 1 1 .9-7.9A5 5 0 0 1 20 13a4 4 0 0 1-1 5z"/>',
    cloud:
      '<path d="M17.5 19H7A5 5 0 1 1 7.5 9.03 6 6 0 0 1 20 11.5 4 4 0 0 1 17.5 19z"/>',
    rain:
      '<path d="M17.5 15H7A5 5 0 1 1 7.5 5.03 6 6 0 0 1 20 7.5 4 4 0 0 1 17.5 15z"/><path d="M8 18v2M12 18v3M16 18v2"/>',
    snow:
      '<path d="M17.5 15H7A5 5 0 1 1 7.5 5.03 6 6 0 0 1 20 7.5 4 4 0 0 1 17.5 15z"/><path d="M8 19h.01M12 19h.01M16 19h.01M10 21h.01M14 21h.01"/>',
    fog:
      '<path d="M17.5 13H7A5 5 0 1 1 7.5 3.03 6 6 0 0 1 20 5.5 4 4 0 0 1 17.5 13z"/><path d="M5 17h14M7 20h10"/>',
    storm:
      '<path d="M17.5 13H7A5 5 0 1 1 7.5 3.03 6 6 0 0 1 20 5.5 4 4 0 0 1 17.5 13z"/><path d="M12 12l-2 4h3l-2 4"/>',
  };

  function setIcon(svg, key) {
    svg.innerHTML = ICONS[key] || ICONS.sun;
  }

  /* ---------- Weather + location -------------------------------------- */

  var CACHE_KEY = 'candorLocalWeather';
  var CACHE_MS = 15 * 60 * 1000; // 15 minutes

  function applyWeather(data) {
    if (!data || !data.location) return;

    var parts = [data.location];
    if (data.temp != null) parts.push(data.temp + '\u00B0' + (data.unit || 'F'));
    if (data.condition) parts.push(data.condition);
    var text = parts.join(' \u00B7 '); // " · "

    var chips = document.querySelectorAll('.weather-chip');
    for (var i = 0; i < chips.length; i++) {
      var chip = chips[i];
      var svg = chip.querySelector('svg');
      var span = chip.querySelector('span');

      if (svg && data.icon) setIcon(svg, data.icon);

      if (span) {
        span.textContent = text; // markup variant 1
      } else if (svg) {
        // svg but no span: drop stray text nodes, add a span after the icon
        var kids = chip.childNodes;
        for (var j = kids.length - 1; j >= 0; j--) {
          if (kids[j].nodeType === 3) chip.removeChild(kids[j]);
        }
        var s = document.createElement('span');
        s.textContent = text;
        chip.appendChild(s);
      } else {
        chip.textContent = text; // markup variant 2 (plain text)
      }
    }
  }

  function fetchWeather() {
    try {
      var cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
      if (cached && Date.now() - cached.t < CACHE_MS) {
        applyWeather(cached.d);
        return;
      }
    } catch (e) {
      /* ignore cache errors */
    }

    fetch('/api/local', { headers: { Accept: 'application/json' } })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (d) {
        if (!d) return;
        applyWeather(d);
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), d: d }));
        } catch (e) {
          /* storage may be unavailable; not critical */
        }
      })
      .catch(function () {
        /* leave the static text in place */
      });
  }

  /* ---------- Boot ----------------------------------------------------- */

  function init() {
    updateDate();
    fetchWeather();
    setInterval(updateDate, 60 * 1000); // keep correct across midnight
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
