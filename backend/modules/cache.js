// PixelFree/backend/modules/cache.js
// Minimal in-memory cache stub; replace with filesystem-backed cache later.

let store = new Map();

export async function ensureCached(photo) {
  if (!store.has(photo.id)) {
    store.set(photo.id, { ...photo, localPath: null, etag: null, lastFetchedAt: Date.now() });
  }
  return store.get(photo.id);
}

export async function getCachedById(id) {
  return store.get(id) || null;
}

export async function clearCache() {
  store.clear();
}

export async function stats() {
  return { items: store.size, bytes: 0 };
}
