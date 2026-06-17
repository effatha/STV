'use strict';

const { fetchM3U } = require('./m3u');
const { XtreamClient } = require('./xtream');
const cache = require('./cache');

/** Extract 2-letter country code from names like "PT| Canal" or "EN: BBC" */
function extractCountry(name) {
  const m = name.match(/^([A-Z]{2})[|\s:]/);
  return m ? m[1] : null;
}

/**
 * Resolve the display group for a channel based on config options:
 *   categoryMode = 'country'   → use country code (or custom label)
 *   categoryMode = 'original'  → keep provider's group-title (default)
 */
function resolveGroup(channel, config) {
  if (config.categoryMode === 'country') {
    if (!channel.country) return config.labels?.['__other__'] || 'Other';
    return config.labels?.[channel.country] || channel.country;
  }
  return channel.group;
}

/**
 * Load raw channels without applying any config filters.
 * Used by the preview API so the UI can show all available countries.
 */
async function loadRawChannels(config) {
  const cacheKey = 'raw:' + JSON.stringify({ type: config.type, url: config.url, host: config.host, username: config.username, password: config.password });
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  let channels = [];
  if (config.type === 'm3u') {
    channels = await fetchM3U(config.url);
  } else if (config.type === 'xtream') {
    const client = new XtreamClient({ host: config.host, username: config.username, password: config.password });
    channels = await client.getChannels();
  } else {
    throw new Error('Unknown source type: ' + config.type);
  }

  channels = channels.map(c => ({ ...c, country: extractCountry(c.name) }));
  cache.set(cacheKey, channels);
  return channels;
}

/**
 * Load channels applying country whitelist, category mode, and label overrides.
 * Returns { channels, groups, countries }
 */
async function loadChannels(config) {
  const cacheKey = 'live:' + JSON.stringify(config);
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  let channels = await loadRawChannels(config);

  // ── Country whitelist ────────────────────────────────────────────────────
  if (config.countries && config.countries.length > 0) {
    channels = channels.filter(c =>
      c.country
        ? config.countries.includes(c.country)
        : config.countries.includes('__other__')
    );
  }

  // ── Apply category mode & labels ─────────────────────────────────────────
  channels = channels.map(c => ({
    ...c,
    group: resolveGroup(c, config),
  }));

  const groupSet = new Set(channels.map(c => c.group));
  const groups = ['All', ...Array.from(groupSet).sort()];

  const countrySet = new Set(channels.map(c => c.country).filter(Boolean));
  const countries = ['All', ...Array.from(countrySet).sort()];

  const result = { channels, groups, countries };
  cache.set(cacheKey, result);
  return result;
}

/**
 * Load VOD movies from Xtream Codes.
 */
async function loadVod(config) {
  if (config.type !== 'xtream') return { movies: [] };

  const cacheKey = 'vod:' + JSON.stringify(config);
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const client = new XtreamClient({ host: config.host, username: config.username, password: config.password });
  const movies = await client.getVod();
  const result = { movies };
  cache.set(cacheKey, result);
  return result;
}

module.exports = { loadChannels, loadRawChannels, loadVod };
