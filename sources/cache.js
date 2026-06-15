'use strict';

/**
 * Simple in-memory cache with TTL.
 * Keyed by config string so each user config has its own cache.
 */
const store = new Map();
const TTL_MS = 10 * 60 * 1000; // 10 minutes

function get(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.time > TTL_MS) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

function set(key, data) {
  store.set(key, { data, time: Date.now() });
}

module.exports = { get, set };
