'use strict';

const { loadChannels } = require('../sources/loader');

const PAGE_SIZE = 100;

/**
 * Stremio catalog handler.
 * type = 'tv', id = 'livetv'
 * extra.genre   → filter by group
 * extra.country → filter by 2-letter country code
 * extra.skip    → pagination offset
 * extra.search  → search by name
 */
async function catalogHandler({ type, id, extra }, config) {
  try {
    const { channels } = await loadChannels(config);

    let list = channels;

    // Filter by genre
    if (extra && extra.genre && extra.genre !== 'All') {
      list = list.filter(c => c.group === extra.genre);
    }

    // Filter by country code (XX| prefix)
    if (extra && extra.country && extra.country !== 'All') {
      list = list.filter(c => c.country === extra.country);
    }

    // Search
    if (extra && extra.search) {
      const q = extra.search.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q));
    }

    // Pagination
    const skip = parseInt((extra && extra.skip) || '0', 10);
    list = list.slice(skip, skip + PAGE_SIZE);

    const metas = list.map(channelToMeta);
    return { metas };
  } catch (err) {
    console.error('[catalog] error:', err.message);
    return { metas: [] };
  }
}

function channelToMeta(ch) {
  return {
    id: ch.id,
    type: 'tv',
    name: ch.name,
    poster: ch.logo || undefined,
    posterShape: 'square',
    logo: ch.logo || undefined,
    genres: [ch.group],
    description: `Live: ${ch.name}`,
    links: [],
    behaviorHints: { defaultVideoId: ch.id },
  };
}

module.exports = { catalogHandler };
