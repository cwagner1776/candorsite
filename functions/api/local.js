/**
 * Cloudflare Pages Function  ->  served at  /api/local
 *
 * Returns the visitor's approximate location plus current weather.
 *  - Location comes from Cloudflare's edge geolocation (request.cf):
 *    city + latitude/longitude. No permission prompt, no API key.
 *  - Weather comes from Open-Meteo (https://open-meteo.com): free, keyless.
 *  - Units are localized: °F for the US (and a few others), °C elsewhere.
 *
 * Response shape:
 *   { location, region, country, unit, temp, condition, icon }
 * Any field may be null if it could not be determined; the front-end
 * degrades gracefully (it keeps whatever static text is already shown).
 */

const FAHRENHEIT_COUNTRIES = new Set(['US', 'BS', 'BZ', 'KY', 'PW', 'FM', 'MH']);

// Map WMO weather-interpretation codes -> short label + icon key.
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

export async function onRequestGet(context) {
  const { request } = context;
  const cf = request.cf || {};

  const country = cf.country || null;
  const lat = cf.latitude;
  const lon = cf.longitude;
  const useF = country ? FAHRENHEIT_COUNTRIES.has(country) : true;

  const payload = {
    location: cf.city || cf.region || null,
    region: cf.region || null,
    country: country,
    unit: useF ? 'F' : 'C',
    temp: null,
    condition: null,
    icon: null,
  };

  if (lat != null && lon != null) {
    try {
      const url =
        'https://api.open-meteo.com/v1/forecast' +
        `?latitude=${lat}&longitude=${lon}` +
        '&current=temperature_2m,weather_code' +
        `&temperature_unit=${useF ? 'fahrenheit' : 'celsius'}` +
        '&timezone=auto';

      // Cache the upstream weather call at the edge, keyed by the URL
      // (i.e. by coordinates), so we don't hit Open-Meteo on every request.
      const res = await fetch(url, {
        cf: { cacheTtl: 600, cacheEverything: true },
      });

      if (res.ok) {
        const data = await res.json();
        const cur = data.current || {};
        if (typeof cur.temperature_2m === 'number') {
          payload.temp = Math.round(cur.temperature_2m);
        }
        const cond = conditionFromCode(cur.weather_code);
        payload.condition = cond.label;
        payload.icon = cond.icon;
      }
    } catch (err) {
      // Weather lookup failed; location + date are still useful on their own.
    }
  }

  return new Response(JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Per-visitor data: let the browser cache for 10 min, but never a shared cache.
      'Cache-Control': 'private, max-age=600',
    },
  });
}
