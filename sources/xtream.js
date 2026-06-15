'use strict';

const axios = require('axios');

/**
 * Xtream Codes API client.
 * Fetches live stream categories and streams.
 */
class XtreamClient {
  constructor({ host, username, password }) {
    this.base = host.replace(/\/$/, '');
    this.username = username;
    this.password = password;
  }

  _api(action, extra = '') {
    return `${this.base}/player_api.php?username=${this.username}&password=${this.password}&action=${action}${extra}`;
  }

  async _get(url) {
    const res = await axios.get(url, {
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0 Stremio LiveTV Addon' },
    });
    return res.data;
  }

  /** Returns array of { id, name } categories */
  async getCategories() {
    const data = await this._get(this._api('get_live_categories'));
    if (!Array.isArray(data)) throw new Error('Invalid Xtream response for categories');
    return data.map(c => ({ id: c.category_id, name: c.category_name }));
  }

  /** Returns all live channels as { id, name, logo, group, url } */
  async getChannels() {
    const [streams, categories] = await Promise.all([
      this._get(this._api('get_live_streams')),
      this.getCategories().catch(() => []),
    ]);

    if (!Array.isArray(streams)) throw new Error('Invalid Xtream response for streams');

    const catMap = {};
    for (const c of categories) catMap[c.id] = c.name;

    return streams.map((s, idx) => ({
      id: `xtream_${s.stream_id}`,
      name: s.name || `Channel ${idx}`,
      logo: s.stream_icon || '',
      group: catMap[s.category_id] || 'Uncategorized',
      // Xtream stream URL format
      url: `${this.base}/live/${this.username}/${this.password}/${s.stream_id}.m3u8`,
      streamId: s.stream_id,
    }));
  }

  /** Returns channels for a specific category */
  async getChannelsByCategory(categoryId) {
    const streams = await this._get(
      this._api('get_live_streams', `&category_id=${categoryId}`)
    );
    if (!Array.isArray(streams)) return [];
    return streams.map(s => ({
      id: `xtream_${s.stream_id}`,
      name: s.name || 'Unknown',
      logo: s.stream_icon || '',
      group: 'Live',
      url: `${this.base}/live/${this.username}/${this.password}/${s.stream_id}.m3u8`,
      streamId: s.stream_id,
    }));
  }
}

module.exports = { XtreamClient };
