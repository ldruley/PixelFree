import { describe, it , expect  } from 'vitest';
import { ensureCached, getCachedById, clearCache, stats } from '../modules/cache.js';

describe('cache.js', () => {
    //Ensure a photo exists in the in-memory cache
    it('ensureCached inserts and returns entry', async () => {
        await clearCache();
        const p = await ensureCached({ id: '1', url: 'u' });
        expect(p).toMatchObject({ id: '1', url: 'u', localPath: null, etag: null });
        const again = await ensureCached({ id: '1', url: 'u2' });
        expect(again.url).toBe('u');
    });
    //Get a cached photo by id
    it('getCachedById and stats', async () => {
        const p = await getCachedById('1');
        expect(p?.id).toBe('1');
        const s = await stats();
        expect(s.items).toBe(1);
        expect(s.bytes).toBe(0);
    });
    // Clear all cached items ,memory only.
    it('clearCache empties store', async () => {
        await clearCache();
        const s = await stats();
        expect(s.items).toBe(0);
    });
});