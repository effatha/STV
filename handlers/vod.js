'use strict';

const { loadVod } = require('../sources/loader');

const PAGE_SIZE = 100;

async function vodCatalogHandler({ extra }, config) {
  try {
    const { movies } = await loadVod(config);
    let list = movies;

    if (extra && extra.genre && extra.genre !== 'All') {
      list = list.filter(m => m.group === extra.genre);
    }

    if (extra && extra.search) {
      const q = extra.search.toLowerCase();
      list = list.filter(m => m.name.toLowerCase().includes(q));
    }

    const skip = parseInt((extra && extra.skip) || '0', 10);
    list = list.slice(skip, skip + PAGE_SIZE);

    return {
      metas: list.map(m => ({
        id: m.id,
        type: 'movie',
        name: m.name,
        poster: m.logo || undefined,
        logo: m.logo || undefined,
        genres: [m.group],
        year: m.year ? parseInt(m.year) : undefined,
        imdbRating: m.rating || undefined,
      })),
    };
  } catch (err) {
    console.error('[vod catalog] error:', err.message);
    return { metas: [] };
  }
}

async function vodStreamHandler({ id }, config) {
  try {
    const { movies } = await loadVod(config);
    const movie = movies.find(m => m.id === id);
    if (!movie) return { streams: [] };
    return {
      streams: [{ url: movie.url, name: movie.name }],
    };
  } catch (err) {
    console.error('[vod stream] error:', err.message);
    return { streams: [] };
  }
}

module.exports = { vodCatalogHandler, vodStreamHandler };
