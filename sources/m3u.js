'use strict';

const axios = require('axios');

/**
 * Fetch and parse an M3U/M3U8 playlist.
 * Returns an array of channel objects:
 *   { id, name, logo, group, url }
 */
async function fetchM3U(playlistUrl) {
  const response = await axios.get(playlistUrl, {
    timeout: 15000,
    responseType: 'text',
    headers: { 'User-Agent': 'Mozilla/5.0 Stremio LiveTV Addon' },
  });

  return parseM3U(response.data);
}

function parseM3U(text) {
  const lines = text.split(/\r?\n/);
  const channels = [];

  if (!lines[0].trim().startsWith('#EXTM3U')) {
    throw new Error('Not a valid M3U playlist');
  }

  let current = null;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF')) {
      current = parseExtInf(line);
    } else if (line.startsWith('#')) {
      // skip other directives
    } else if (current) {
      // This line is the stream URL
      current.url = line;
      current.id = slugify(current.name) + '_' + channels.length;
      channels.push(current);
      current = null;
    }
  }

  return channels;
}

function parseExtInf(line) {
  const channel = {
    name: '',
    logo: '',
    group: 'Uncategorized',
    url: '',
  };

  // Extract attributes: key="value" or key=value
  const attrRe = /(\S+?)=["']?([^"',\s]+(?:\s[^"',\s]+)*)["']?/g;
  let m;
  while ((m = attrRe.exec(line)) !== null) {
    const key = m[1].toLowerCase();
    const val = m[2];
    if (key === 'tvg-name') channel.name = val;
    else if (key === 'tvg-logo') channel.logo = val;
    else if (key === 'group-title') channel.group = val || 'Uncategorized';
    else if (key === 'tvg-id') channel.tvgId = val;
  }

  // Channel name is after the last comma
  const commaIdx = line.lastIndexOf(',');
  if (commaIdx !== -1) {
    const nameFromLine = line.slice(commaIdx + 1).trim();
    if (!channel.name && nameFromLine) channel.name = nameFromLine;
    else if (!channel.name) channel.name = 'Unknown Channel';
  }

  // Re-parse group-title separately because it can contain spaces
  const groupMatch = line.match(/group-title=["']([^"']*)["']/i);
  if (groupMatch) channel.group = groupMatch[1] || 'Uncategorized';

  const logoMatch = line.match(/tvg-logo=["']([^"']*)["']/i);
  if (logoMatch) channel.logo = logoMatch[1];

  const nameMatch = line.match(/tvg-name=["']([^"']*)["']/i);
  if (nameMatch && nameMatch[1]) channel.name = nameMatch[1];

  return channel;
}

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
}

module.exports = { fetchM3U, parseM3U };
