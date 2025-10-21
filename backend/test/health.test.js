import { describe , it , expect , vi } from 'vitest';
import { getHealth } from '../modules/health.js';

vi.mock('../modules/cache.js', () => ({
    stats: vi.fn().mockResolvedValue({ items: 3, bytes: 12345 }),
}));

describe('health.js', () => {
    //return health info used by monitors/load balancers
    it('getHealth returns ok, uptimeSec, cache', async () => {
        const h = await getHealth();
        expect(h.ok).toBe(true);
        expect(typeof h.uptimeSec).toBe('number');
        expect(h.cache).toEqual({ items: 3, bytes: 12345 });
    });
});