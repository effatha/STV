'use strict';

const { loadChannels } = require('../sources/loader');

/**
 * Stremio stream handler.
 * id = channel id (same as used in catalog)
 */
async function streamHandler({ type, id }, config) {
  try {
    const { channels } = await loadChannels(config);
    const channel = channels.find(c => c.id === id);

    if (!channel) {
      console.warn('[stream] channel not found:', id);
      return { streams: [] };
    }

    return {
      streams: [
        {
          url: channel.url,
          name: channel.name,
          title: channel.group,
          // behaviorHints helps Stremio know it's a live stream
          behaviorHints: {
            notWebReady: false,
            bingeGroup: 'livetv',
          },
        },
      ],
    };
  } catch (err) {
    console.error('[stream] error:', err.message);
    return { streams: [] };
  }
}

module.exports = { streamHandler };
