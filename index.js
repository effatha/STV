'use strict';

const express = require('express');
const path = require('path');
const { loadChannels, loadRawChannels, loadVod } = require('./sources/loader');
const { catalogHandler } = require('./handlers/catalog');
const { streamHandler } = require('./handlers/stream');
const { vodCatalogHandler, vodStreamHandler } = require('./handlers/vod');
const { epgHandler } = require('./handlers/epg');

const PORT = process.env.PORT || 7860;
const app = express();

// ─── CORS ────────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  next();
});

// ─── Static config UI ────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'configure.html'));
});

app.get('/configure', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'configure.html'));
});

// ─── Config decoder ──────────────────────────────────────────────────────────
function decodeConfig(encoded) {
  try {
    const json = Buffer.from(encoded, 'base64').toString('utf-8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// ─── Manifest ────────────────────────────────────────────────────────────────
async function buildManifest(config) {
  let genres = [];
  let countries = [];
  let vodGenres = [];

  try {
    const { groups, countries: c } = await loadChannels(config);
    genres = groups;
    countries = c;
  } catch (e) {
    console.error('[manifest] could not load live channels:', e.message);
  }

  if (config.type === 'xtream') {
    try {
      const { movies } = await loadVod(config);
      const vodGroupSet = new Set(movies.map(m => m.group));
      vodGenres = ['All', ...Array.from(vodGroupSet).sort()];
    } catch (e) {
      console.error('[manifest] could not load VOD:', e.message);
    }
  }

  const catalogs = [
    {
      type: 'tv',
      id: 'livetv',
      name: 'Live TV',
      extra: [
        { name: 'genre', options: genres, isRequired: false },
        { name: 'country', options: countries, isRequired: false },
        { name: 'skip', isRequired: false },
        { name: 'search', isRequired: false },
      ],
    },
  ];

  if (config.type === 'xtream') {
    catalogs.push({
      type: 'movie',
      id: 'vod',
      name: 'VOD',
      extra: [
        { name: 'genre', options: vodGenres, isRequired: false },
        { name: 'skip', isRequired: false },
        { name: 'search', isRequired: false },
      ],
    });
  }

  const types = config.type === 'xtream' ? ['tv', 'movie'] : ['tv'];

  return {
    id: 'community.livetv.' + Buffer.from(JSON.stringify(config)).toString('base64').slice(0, 12),
    version: '1.2.0',
    name: 'Live TV',
    description: 'Live TV channels and VOD from your M3U playlist or Xtream Codes provider.',
    logo: 'https://dl.strem.io/addon-logo.png',
    background: 'https://dl.strem.io/addon-background.jpg',
    resources: ['catalog', 'stream', 'meta', 'scheduledVideos'],
    types,
    idPrefixes: ['xtream_', 'livetv_', 'vod_'],
    catalogs,
    behaviorHints: {
      configurable: true,
      configurationURL: `https://stv-ncta.onrender.com/configure`,
    },
  };
}

// ─── Meta handler ────────────────────────────────────────────────────────────
async function metaHandler({ type, id }, config) {
  try {
    const { channels } = await loadChannels(config);
    const ch = channels.find(c => c.id === id);
    if (!ch) return { meta: null };
    return {
      meta: {
        id: ch.id,
        type: 'tv',
        name: ch.name,
        poster: ch.logo || undefined,
        posterShape: 'square',
        logo: ch.logo || undefined,
        genres: [ch.group],
        description: `Live: ${ch.name}`,
        behaviorHints: { defaultVideoId: ch.id },
      },
    };
  } catch {
    return { meta: null };
  }
}

// ─── Preview API (used by configure UI) ──────────────────────────────────────
app.get('/api/preview', async (req, res) => {
  const config = decodeConfig(req.query.config);
  if (!config) return res.status(400).json({ error: 'Invalid config' });
  try {
    const channels = await loadRawChannels(config);
    const countrySet = new Set(channels.map(c => c.country).filter(Boolean));
    const groupSet   = new Set(channels.map(c => c.group));
    res.json({
      total: channels.length,
      countries: Array.from(countrySet).sort(),
      groups: Array.from(groupSet).sort(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Routes ──────────────────────────────────────────────────────────────────
app.get('/:config/manifest.json', async (req, res) => {
  const config = decodeConfig(req.params.config);
  if (!config) return res.status(400).json({ error: 'Invalid config' });
  try {
    const manifest = await buildManifest(config);
    res.json(manifest);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/:config/catalog/:type/:id.json', async (req, res) => {
  const config = decodeConfig(req.params.config);
  if (!config) return res.status(400).json({ error: 'Invalid config' });

  // Parse extra params from query string (Stremio sends them as query params
  // OR encoded in the path as /:id/:extra.json — handle both)
  const extra = { ...req.query };
  if (req.params.id.includes('=')) {
    // Parse path-encoded extras like "genre=News&skip=0"
    for (const part of req.params.id.split('&')) {
      const [k, v] = part.split('=');
      if (k && v !== undefined) extra[k] = decodeURIComponent(v);
    }
  }

  const result = req.params.type === 'movie'
    ? await vodCatalogHandler({ extra }, config)
    : await catalogHandler({ type: req.params.type, id: 'livetv', extra }, config);
  res.json(result);
});

// Route with extra params encoded in path: /:config/catalog/tv/livetv/genre=X.json
app.get('/:config/catalog/:type/:id/:extra.json', async (req, res) => {
  const config = decodeConfig(req.params.config);
  if (!config) return res.status(400).json({ error: 'Invalid config' });

  const extra = {};
  for (const part of req.params.extra.split('&')) {
    const eq = part.indexOf('=');
    if (eq !== -1) {
      const k = part.slice(0, eq);
      const v = decodeURIComponent(part.slice(eq + 1));
      extra[k] = v;
    }
  }

  const result = req.params.type === 'movie'
    ? await vodCatalogHandler({ extra }, config)
    : await catalogHandler({ type: req.params.type, id: 'livetv', extra }, config);
  res.json(result);
});

app.get('/:config/meta/:type/:id.json', async (req, res) => {
  const config = decodeConfig(req.params.config);
  if (!config) return res.status(400).json({ error: 'Invalid config' });
  const result = await metaHandler({ type: req.params.type, id: req.params.id }, config);
  res.json(result);
});

app.get('/:config/stream/:type/:id.json', async (req, res) => {
  const config = decodeConfig(req.params.config);
  if (!config) return res.status(400).json({ error: 'Invalid config' });
  const { type, id } = req.params;
  const result = type === 'movie' || id.startsWith('vod_')
    ? await vodStreamHandler({ id }, config)
    : await streamHandler({ type, id }, config);
  res.json(result);
});

app.get('/:config/scheduledVideos/:type/:id.json', async (req, res) => {
  const config = decodeConfig(req.params.config);
  if (!config) return res.status(400).json({ error: 'Invalid config' });
  const result = await epgHandler({ type: req.params.type, id: req.params.id }, config);
  res.json(result);
});

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🎬  Stremio Live TV Addon running`);
  console.log(`    Config UI : http://localhost:${PORT}/configure`);
  console.log(`    Port      : ${PORT}\n`);
});
