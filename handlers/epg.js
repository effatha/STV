'use strict';

const { loadChannels } = require('../sources/loader');
const { fetchXtreamEpg } = require('../sources/epg');

/**
 * Stremio scheduledVideos handler.
 * Called with the channel id — returns its EPG programs as videos.
 *
 * Each video represents one scheduled program:
 *   id        → unique per program
 *   title     → program name
 *   released  → start time (ISO)
 *   availableUntil → end time (ISO)
 *   streams   → the channel's live stream URL
 */
async function epgHandler({ type, id }, config) {
  if (config.type !== 'xtream') {
    // M3U sources don't have EPG API — return empty
    return { videos: [] };
  }

  try {
    const { channels } = await loadChannels(config);
    const channel = channels.find(c => c.id === id);
    if (!channel || !channel.streamId) return { videos: [] };

    const programs = await fetchXtreamEpg(
      { host: config.host, username: config.username, password: config.password },
      channel.streamId
    );

    const videos = programs.map(p => ({
      id: `${id}:${p.id}`,
      title: p.title || 'Unknown Program',
      released: p.start.toISOString(),
      availableUntil: p.end.toISOString(),
      description: p.description || undefined,
      thumbnail: p.thumbnail || channel.logo || undefined,
      // Stream is always the live channel regardless of what program is on
      streams: [
        {
          url: channel.url,
          name: channel.name,
          title: p.title,
          behaviorHints: { notWebReady: false, bingeGroup: 'livetv' },
        },
      ],
    }));

    return { videos };
  } catch (err) {
    console.error('[epg] error for', id, ':', err.message);
    return { videos: [] };
  }
}

module.exports = { epgHandler };
