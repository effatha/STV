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
 * Load channels from the user's config (M3U or Xtream).
 * Returns { channels, groups, countries } with 10-minute caching.
 */
async function loadChannels(config) {
  const cacheKey = 'live:' + JSON.stringify(config);
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  let channels = [];

  if (config.type === 'm3u') {
    channels = await fetchM3U(config.url);
  } else if (config.type === 'xtream') {
    const client = new XtreamClient({
      host: config.host,
      username: config.username,
      password: config.password,
    });
    channels = await client.getChannels();
  } else {
    throw new Error('Unknown source type: ' + config.type);
  }

  // Attach country code to each channel
  channels = channels.map(c => ({
    ...c,
    country: extractCountry(c.name),
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
 * Returns { movies } with 10-minute caching.
 */
async function loadVod(config) {
  if (config.type !== 'xtream') return { movies: [] };

  const cacheKey = 'vod:' + JSON.stringify(config);
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const client = new XtreamClient({
    host: config.host,
    username: config.username,
    password: config.password,
  });

  const movies = await client.getVod();
  const result = { movies };
  cache.set(cacheKey, result);
  return result;
}

module.exports = { loadChannels, loadVod };
