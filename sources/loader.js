'use strict';

const { fetchM3U } = require('./m3u');
const { XtreamClient } = require('./xtream');
const cache = require('./cache');

/**
 * Load channels from the user's config (M3U or Xtream).
 * Returns { channels, groups } with 10-minute caching.
 */
async function loadChannels(config) {
  const cacheKey = JSON.stringify(config);
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

  // Collect unique group names
  const groupSet = new Set(channels.map(c => c.group));
  const groups = ['All', ...Array.from(groupSet).sort()];

  const result = { channels, groups };
  cache.set(cacheKey, result);
  return result;
}

module.exports = { loadChannels };
