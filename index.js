'use strict';

const express = require('express');
const path = require('path');
const { loadChannels } = require('./sources/loader');
const { catalogHandler } = require('./handlers/catalog');
const { streamHandler } = require('./handlers/stream');

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
  try {
    const { groups } = await loadChannels(config);
    genres = groups;
  } catch (e) {
    console.error('[manifest] could not load genres:', e.message);
  }

  return {
    id: 'community.livetv.' + Buffer.from(JSON.stringify(config)).toString('base64').slice(0, 12),
    version: '1.0.0',
    name: 'Live TV',
    description: 'Live TV channels from your M3U playlist or Xtream Codes provider.',
    logo: 'https://dl.strem.io/addon-logo.png',
    background: 'https://dl.strem.io/addon-background.jpg',
    resources: ['catalog', 'stream', 'meta'],
    types: ['tv'],
    idPrefixes: ['xtream_', 'livetv_'],
    catalogs: [
      {
        type: 'tv',
        id: 'livetv',
        name: 'Live TV',
        extra: [
          { name: 'genre', options: genres, isRequired: false },
          { name: 'skip', isRequired: false },
          { name: 'search', isRequired: false },
        ],
      },
    ],
    behaviorHints: {
      configurable: true,
      configurationURL: `http://localhost:${PORT}/configure`,
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

  const result = await catalogHandler(
    { type: req.params.type, id: 'livetv', extra },
    config
  );
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

  const result = await catalogHandler(
    { type: req.params.type, id: 'livetv', extra },
    config
  );
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
  const result = await streamHandler({ type: req.params.type, id: req.params.id }, config);
  res.json(result);
});

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🎬  Stremio Live TV Addon running`);
  console.log(`    Config UI : http://localhost:${PORT}/configure`);
  console.log(`    Port      : ${PORT}\n`);
});
