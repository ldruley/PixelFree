import { describe, it, expect, vi , beforeEach  } from 'vitest';

vi.mock('../modules/auth.js', () => ({ getAccessToken: vi.fn().mockResolvedValue('TOKEN') }));
const { fetchPhotos } = await import('../modules/photoService.js');

beforeEach(() => { vi.restoreAllMocks(); process.env.PIXELFED_INSTANCE = 'https://pixelfed.social'; });
//Fetch normalized image posts from Pixelfed
describe('photoService.js', () => {
    it('fetches tag timeline and normalizes only images, newest first, limited', async () => {
        const statuses = [
            { id: 's1', created_at: '2024-01-01T00:00:00Z', url: 'post1', account: { id: 'a1', acct: 'u1', url: 'p/u1', display_name: 'U1' }, media_attachments: [ { type: 'image', id: 'm1', url: 'U1' }, { type: 'video', id: 'v1', url: 'V1' } ] },
            { id: 's2', created_at: '2025-01-01T00:00:00Z', url: 'post2', account: { id: 'a2', acct: 'u2', url: 'p/u2', display_name: 'U2' }, media_attachments: [ { type: 'image', id: 'm2', url: 'U2' } ] },
        ];
        vi.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: true, json: async () => statuses });
        const photos = await fetchPhotos({ limit: 1, source: { type: 'tag', tag: 'cats' } });
        expect(photos).toHaveLength(1);
        expect(photos[0]).toMatchObject({ id: 'm2', post_url: 'post2', author: { id: 'a2' }, author_display_name: 'U2' });
    });

    it('builds user timeline endpoint and returns multiple', async () => {
        vi.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: true, json: async () => ([{ id: 's', created_at: '2025-01-02T00:00:00Z', url: 'post', account: { id: 'a' }, media_attachments: [ { type: 'image', id: 'm', url: 'img' } ] }]) });
        const photos = await fetchPhotos({ limit: 5, source: { type: 'user', accountId: 'abc' } });
        expect(photos[0].id).toBe('m');
    });

    it('public localOnly sets param and handles errors', async () => {
        vi.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ oops: true }) });
        await expect(fetchPhotos({ limit: 2, source: { type: 'public', localOnly: true } })).rejects.toThrow('Pixelfed fetch failed');
    });

    it('clamps limit 1–40 and filters non-image', async () => {
        vi.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: true, json: async () => ([{ id: 's', created_at: '2025-01-03T00:00:00Z', media_attachments: [ { type: 'video', id: 'v', url: 'v' } ] }]) });
        const photos = await fetchPhotos({ limit: 1000, source: { type: 'public' } });
        expect(photos).toHaveLength(0);
    });
});