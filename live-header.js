/**
 * live-header.js — makes the masthead location / weather / date chips live.
 *
 * Fully client-side: works on ANY static host (Cloudflare Workers or Pages,
 * GitHub Pages, Netlify, etc.) with no server function or config.
 *
 *  - Date:     updated immediately from the visitor's browser.
 *  - Location: approximate city from a free, keyless IP lookup (ipwho.is,
 *              falling back to geojs.io).
 *  - Weather:  current conditions from Open-Meteo (free, keyless).
 *
 * If any network call fails, the existing static text is left untouched.
 * Works with both header markups on the site:
 *   1) <div class="weather-chip"><svg>…</svg><span>…</span></div>
 *   2) <div class="weather-chip">…</div>
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

  /* ---------- WMO weather code -> label + icon ------------------------ */

  function conditionFromCode(code) {
    if (code === 0) return { label: 'Clear', icon: 'sun' };
    if (code === 1) return { label: 'Mostly Clear', icon: 'sun' };
    if (code === 2) return { label: 'Partly Cloudy', icon: 'cloud-sun' };
    if (code === 3) return { label: 'Overcast', icon: 'cloud' };
    if (code === 45 || code === 48) return { label: 'Fog', icon: 'fog' };
    if (code >= 51 && code <= 57) return { label: 'Drizzle', icon: 'rain' };
    if (code >= 61 && code <= 67) return { label: 'Rain', icon: 'rain' };
    if (code >= 71 && code <= 77) return { label: 'Snow', icon: 'snow' };
    if (code >= 80 && code <= 82) return { label: 'Showers', icon: 'rain' };
    if (code === 85 || code === 86) return { label: 'Snow', icon: 'snow' };
    if (code >= 95) return { label: 'Thunderstorm', icon: 'storm' };
    return { label: 'Clear', icon: 'sun' };
  }

  // Countries that use Fahrenheit.
  var FAHRENHEIT = { US: 1, BS: 1, BZ: 1, KY: 1, PW: 1, FM: 1, MH: 1 };

  /* ---------- Apply to the chips -------------------------------------- */

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

  /* ---------- Network lookups ----------------------------------------- */

  // Approximate location from the visitor's IP. Tries ipwho.is, then geojs.io.
  function getLocation() {
    return fetch('https://ipwho.is/')
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && j.success !== false && j.latitude != null) {
          return {
            city: j.city || j.region || null,
            country: j.country_code || null,
            lat: j.latitude,
            lon: j.longitude,
          };
        }
        throw new Error('primary geo unavailable');
      })
      .catch(function () {
        return fetch('https://get.geojs.io/v1/ip/geo.json')
          .then(function (r) { return r.json(); })
          .then(function (j) {
            return {
              city: j.city || j.region || null,
              country: j.country_code || null,
              lat: parseFloat(j.latitude),
              lon: parseFloat(j.longitude),
            };
          });
      });
  }

  function getWeather(lat, lon, useF) {
    var url =
      'https://api.open-meteo.com/v1/forecast' +
      '?latitude=' + lat + '&longitude=' + lon +
      '&current=temperature_2m,weather_code' +
      '&temperature_unit=' + (useF ? 'fahrenheit' : 'celsius') +
      '&timezone=auto';
    return fetch(url).then(function (r) { return r.json(); });
  }

  var CACHE_KEY = 'candorLocalWeather';
  var CACHE_MS = 15 * 60 * 1000; // 15 minutes

  function loadLive() {
    try {
      var cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
      if (cached && Date.now() - cached.t < CACHE_MS) {
        applyWeather(cached.d);
        return;
      }
    } catch (e) {
      /* ignore cache errors */
    }

    getLocation()
      .then(function (loc) {
        if (!loc || loc.lat == null || isNaN(loc.lat)) return;
        var useF = !!FAHRENHEIT[loc.country];
        return getWeather(loc.lat, loc.lon, useF).then(function (w) {
          var cur = (w && w.current) || {};
          var cond = conditionFromCode(cur.weather_code);
          var data = {
            location: loc.city,
            unit: useF ? 'F' : 'C',
            temp:
              typeof cur.temperature_2m === 'number'
                ? Math.round(cur.temperature_2m)
                : null,
            condition: cond.label,
            icon: cond.icon,
          };
          applyWeather(data);
          try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), d: data }));
          } catch (e) {
            /* storage may be unavailable; not critical */
          }
        });
      })
      .catch(function () {
        /* leave the static text in place */
      });
  }

  /* ---------- Boot ----------------------------------------------------- */

  function init() {
    updateDate();
    loadLive();
    setInterval(updateDate, 60 * 1000); // keep correct across midnight
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
