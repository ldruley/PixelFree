import { it, expect, vi, beforeEach} from 'vitest';

vi.mock('../modules/auth.js', () => ({ getAccessToken: vi.fn().mockResolvedValue('TOKEN') }));

const { resolveAccountId, resolveManyAccts } = await import('../modules/accounts.js');

beforeEach(() => { vi.restoreAllMocks(); });

    it('accepts profile URL and resolves via v2 search', async () => {
        const url = 'https://pixelfed.social/@alice';

        vi.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers(), json: async () => ({ accounts: [{ id: '123' }] }) });
        const id = await resolveAccountId(url);
        expect(id).toBe('123');
    });
    it('falls back to v1 lookup for local username', async () => {

        vi.spyOn(global, 'fetch')
            .mockResolvedValueOnce({ ok: false, status: 404, headers: new Headers(), json: async () => ({}) })
            .mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers(), json: async () => ({ id: 'A' }) })
            .mockResolvedValueOnce({ ok: false, status: 404, headers: new Headers(), json: async () => ({}) });
        const id = await resolveAccountId('alice');
        expect(id).toBe('A');
    });

    it('falls back to v1 search', async () => {
        vi.spyOn(global, 'fetch')
            .mockResolvedValueOnce({ ok: false, status: 404, headers: new Headers(), json: async () => ({}) }) // v2
            .mockResolvedValueOnce({ ok: false, status: 404, headers: new Headers(), json: async () => ({}) }) // v1 lookup
            .mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers(), json: async () => ([{ id: 'Z' }]) }); // v1 search
        const id = await resolveAccountId('@bob');
        expect(id).toBe('Z');
    });

    it('resolveManyAccts dedupes, caches, and returns unique ids', async () => {
// First call hits network once and caches, second call should reuse
        const spy = vi.spyOn(global, 'fetch')
            .mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers(), json: async () => ({ accounts: [{ id: '1' }] }) });
        const ids1 = await resolveManyAccts(['@alice@h.com', 'alice@h.com', 'alice@h.com']);
        expect(ids1).toEqual(['1']);

        const ids2 = await resolveManyAccts(['alice@h.com']);
        expect(ids2).toEqual(['1']);
        expect(spy).toHaveBeenCalledTimes(1); // cache hit for second
});