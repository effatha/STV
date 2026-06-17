'use strict';

const axios = require('axios');

// EPG cache: channelKey → { data, time }
// Longer TTL than channel list — EPG data changes slowly
const epgCache = new Map();
const EPG_TTL_MS = 60 * 60 * 1000; // 1 hour

function epgCacheGet(key) {
  const entry = epgCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.time > EPG_TTL_MS) { epgCache.delete(key); return null; }
  return entry.data;
}

function epgCacheSet(key, data) {
  epgCache.set(key, { data, time: Date.now() });
}

/**
 * Fetch 7-day EPG for a single Xtream stream ID.
 * Returns array of { id, title, description, start, end }
 */
async function fetchXtreamEpg({ host, username, password }, streamId) {
  const cacheKey = `${host}:${streamId}`;
  const cached = epgCacheGet(cacheKey);
  if (cached) return cached;

  const url = `${host.replace(/\/$/, '')}/player_api.php`
    + `?username=${username}&password=${password}`
    + `&action=get_epg&stream_id=${streamId}`;

  const res = await axios.get(url, {
    timeout: 20000,
    headers: { 'User-Agent': 'Mozilla/5.0 Stremio LiveTV Addon' },
  });

  const listings = res.data && Array.isArray(res.data.epg_listings)
    ? res.data.epg_listings
    : [];

  const programs = listings.map(p => {
    // Xtream timestamps are Unix seconds
    const start = new Date(p.start_timestamp ? p.start_timestamp * 1000 : p.start);
    const end   = new Date(p.stop_timestamp  ? p.stop_timestamp  * 1000 : p.end);
    return {
      id: `${streamId}_${p.start_timestamp || start.getTime()}`,
      title: decodeTitle(p.title),
      description: decodeTitle(p.description || ''),
      thumbnail: p.image || p.thumb || undefined,
      start,
      end,
    };
  }).filter(p => !isNaN(p.start) && !isNaN(p.end));

  epgCacheSet(cacheKey, programs);
  return programs;
}

/** Xtream often base64-encodes title/description */
function decodeTitle(str) {
  if (!str) return '';
  try {
    const decoded = Buffer.from(str, 'base64').toString('utf-8');
    // Only accept if it looks like valid text (not garbage)
    if (/^[\x20-\x7EÀ-ɏ\s]+$/.test(decoded)) return decoded.trim();
  } catch {}
  return str.trim();
}

module.exports = { fetchXtreamEpg };
