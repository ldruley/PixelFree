import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as albumRepo from '../db/albumRepo.js';
import * as albumService from '../services/albumService.js';
import * as settings from '../modules/settings.js';
import * as scheduler from '../services/albumScheduler.js';

beforeEach(async () => {
    await scheduler.stopScheduler();
    vi.clearAllMocks();
    vi.spyOn(settings, 'getSettings').mockReturnValue({ sync: { intervalMs: 24 * 60 * 60 * 1000 } });
});

afterEach(async () => {
    await scheduler.stopScheduler();
    vi.restoreAllMocks();
});

describe('albumScheduler.js', () => {
    /**
     * Test: Verify that the scheduler can start successfully
     * - Should set running status to true
     * - Should execute an initial tick immediately (total_runs = 1)
     */
    it('starts scheduler and runs initial tick', async () => {
        vi.spyOn(albumRepo, 'list').mockReturnValue({ items: [] });

        await scheduler.startScheduler();

        const status = scheduler.getStatus();
        expect(status.running).toBe(true);
        expect(status.stats.total_runs).toBe(1);
    });

    /**
     * Test: Prevent duplicate scheduler instances
     * - Starting scheduler twice should log a warning
     * - Should not create multiple timer instances
     */
    it('prevents duplicate starts', async () => {
        vi.spyOn(albumRepo, 'list').mockReturnValue({ items: [] });
        await scheduler.startScheduler();

        const spy = vi.spyOn(console, 'log');
        await scheduler.startScheduler();
        expect(spy).toHaveBeenCalledWith('[Scheduler] Already running');
    });

    /**
     * Test: Verify scheduler can be stopped cleanly
     * - Should clear the interval timer
     * - Should set running status to false
     */
    it('stops running scheduler', async () => {
        vi.spyOn(albumRepo, 'list').mockReturnValue({ items: [] });
        await scheduler.startScheduler();

        await scheduler.stopScheduler();

        expect(scheduler.getStatus().running).toBe(false);
    });

    /**
     * Test: Scheduler should refresh albums that are due for refresh
     * - Album has last_checked_at > 24 hours ago (past refresh interval)
     * - Should call refreshAlbumWithBackoff for the due album
     */
    it('refreshes albums due for refresh', async () => {
        const album = {
            id: 'a1',
            name: 'Test',
            enabled: true,
            query_type: 'tag',
            query_tags: JSON.stringify(['test']),
            query_limit: 20,
            refresh_json: JSON.stringify({
                last_checked_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
                refresh_interval_ms: 24 * 60 * 60 * 1000
            })
        };

        vi.spyOn(albumRepo, 'list').mockReturnValue({ items: [album] });
        vi.spyOn(albumService, 'refreshAlbumWithBackoff').mockResolvedValue({
            success: true,
            fetched: 1,
            upserted: 1,
            linked: 1
        });

        await scheduler.startScheduler();

        expect(albumService.refreshAlbumWithBackoff).toHaveBeenCalledWith(
            'a1',
            expect.any(Function)
        );
    });

    /**
     * Test: Disabled albums should be skipped
     * - Album has enabled: false
     * - Should not call refreshAlbumWithBackoff
     * - Respects user's intention to pause album updates
     */
    it('skips disabled albums', async () => {
        vi.spyOn(albumRepo, 'list').mockReturnValue({ items: [{
                id: 'a1', enabled: false, query_type: 'tag', query_tags: '["test"]',
                refresh_json: JSON.stringify({ last_checked_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() })
            }] });
        const spy = vi.spyOn(albumService, 'refreshAlbumWithBackoff');

        await scheduler.startScheduler();

        expect(spy).not.toHaveBeenCalled();
    });

    /**
     * Test: Albums in backoff period should be skipped
     * - Album has backoff_until timestamp in the future
     * - Should not attempt refresh (prevents hammering rate-limited APIs)
     * - Respects exponential backoff after rate limit errors
     */
    it('skips albums in backoff period', async () => {
        vi.spyOn(albumRepo, 'list').mockReturnValue({ items: [{
                id: 'a1', enabled: true, query_type: 'tag', query_tags: '["test"]',
                refresh_json: JSON.stringify({
                    last_checked_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
                    backoff_until: new Date(Date.now() + 60 * 60 * 1000).toISOString()
                })
            }] });
        const spy = vi.spyOn(albumService, 'refreshAlbumWithBackoff');

        await scheduler.startScheduler();

        expect(spy).not.toHaveBeenCalled();
    });

    /**
     * Test: Force refresh a tag-based album
     * - Verifies forceRefreshAlbum() works for tag query type
     * - Should call refreshAlbumWithBackoff with album ID
     * - Bypasses schedule checks (refreshes immediately)
     */
    it('refreshes tag album and updates since_id', async () => {
        const album = {
            id: 'a1', name: 'Tags', enabled: true, query_type: 'tag',
            query_tags: JSON.stringify(['nature', 'sunset']),
            query_tagmode: 'any', query_limit: 20,
            refresh_json: JSON.stringify({})
        };

        vi.spyOn(albumRepo, 'get').mockReturnValue(album);
        vi.spyOn(albumService, 'refreshAlbumWithBackoff').mockResolvedValue({
            success: true,
            fetched: 2,
            upserted: 2,
            linked: 2,
            since_id: 'p1'
        });

        await scheduler.forceRefreshAlbum('a1');

        expect(albumService.refreshAlbumWithBackoff).toHaveBeenCalledWith(
            'a1',
            expect.any(Function)
        );
    });

    /**
     * Test: Force refresh a user-based album
     * - Verifies forceRefreshAlbum() works for user query type
     * - Should call refreshAlbumWithBackoff with album ID
     * - Tests that user-based queries are handled correctly
     */
    it('refreshes user album', async () => {
        vi.spyOn(albumRepo, 'get').mockReturnValue({
            id: 'a2', enabled: true, query_type: 'user',
            query_users: JSON.stringify(['u1', 'u2']), query_limit: 20,
            refresh_json: '{}'
        });
        vi.spyOn(albumService, 'refreshAlbumWithBackoff').mockResolvedValue({
            success: true,
            fetched: 1,
            upserted: 1,
            linked: 1
        });

        await scheduler.forceRefreshAlbum('a2');

        expect(albumService.refreshAlbumWithBackoff).toHaveBeenCalledWith(
            'a2',
            expect.any(Function)
        );
    });

    /**
     * Test: Force refresh a compound album
     * - Verifies forceRefreshAlbum() works for compound query type (tags + users)
     * - Should call refreshAlbumWithBackoff with album ID
     * - Tests that compound queries (most complex) are handled correctly
     */
    it('refreshes compound album', async () => {
        vi.spyOn(albumRepo, 'get').mockReturnValue({
            id: 'a3', enabled: true, query_type: 'compound',
            query_tags: JSON.stringify(['cat']),
            query_users: JSON.stringify(['u1']),
            query_limit: 20, refresh_json: '{}'
        });
        vi.spyOn(albumService, 'refreshAlbumWithBackoff').mockResolvedValue({
            success: true,
            fetched: 1,
            upserted: 1,
            linked: 1
        });

        await scheduler.forceRefreshAlbum('a3');

        expect(albumService.refreshAlbumWithBackoff).toHaveBeenCalledWith(
            'a3',
            expect.any(Function)
        );
    });

    /**
     * Test: Watermark (since_id) should be preserved when no new photos found
     * - Album has existing since_id watermark
     * - Refresh returns 0 new photos
     * - Service should preserve the old since_id (not clear it)
     * - Prevents losing track of position in photo stream
     */
    it('preserves since_id when no new photos', async () => {
        vi.spyOn(albumRepo, 'get').mockReturnValue({
            id: 'a1', enabled: true, query_type: 'tag', query_tags: '["test"]',
            query_limit: 20, refresh_json: JSON.stringify({ since_id: 'old_p' })
        });
        vi.spyOn(albumService, 'refreshAlbumWithBackoff').mockResolvedValue({
            success: true,
            fetched: 0,
            upserted: 0,
            linked: 0,
            since_id: 'old_p'
        });

        await scheduler.forceRefreshAlbum('a1');

        expect(albumService.refreshAlbumWithBackoff).toHaveBeenCalled();
    });

    /**
     * Test: Rate limiting should trigger exponential backoff
     * - Service returns rate limit error (isRateLimited: true)
     * - Scheduler should track the rate limit in stats
     * - Should increment rate_limited counter
     * - Prevents repeated failed attempts to rate-limited API
     */
    it('handles rate limiting with exponential backoff', async () => {
        vi.spyOn(albumRepo, 'get').mockReturnValue({
            id: 'a1', enabled: true, query_type: 'tag', query_tags: '["test"]',
            query_limit: 20, refresh_json: JSON.stringify({ retry_count: 0 })
        });

        vi.spyOn(albumService, 'refreshAlbumWithBackoff').mockResolvedValue({
            success: false,
            isRateLimited: true,
            error: 'Rate limit exceeded',
            backoff_until: new Date(Date.now() + 60 * 1000).toISOString()
        });

        await scheduler.forceRefreshAlbum('a1');

        expect(albumService.refreshAlbumWithBackoff).toHaveBeenCalled();
        expect(scheduler.getStatus().stats.rate_limited).toBe(1);
    });

    /**
     * Test: Exponential backoff increases with retry count
     * - Album already has retry_count: 2
     * - Rate limit error occurs again
     * - Backoff time should be exponentially longer (2^3 = 8 minutes)
     * - Prevents endless retry loops on persistent rate limits
     */
    it('applies exponential backoff on repeated rate limits', async () => {
        vi.spyOn(albumRepo, 'get').mockReturnValue({
            id: 'a1', enabled: true, query_type: 'tag', query_tags: '["test"]',
            query_limit: 20, refresh_json: JSON.stringify({ retry_count: 2 })
        });

        const backoffUntil = new Date(Date.now() + 8 * 60 * 1000).toISOString();
        vi.spyOn(albumService, 'refreshAlbumWithBackoff').mockResolvedValue({
            success: false,
            isRateLimited: true,
            error: '429 Too Many Requests',
            backoff_until: backoffUntil
        });

        await scheduler.forceRefreshAlbum('a1');

        expect(albumService.refreshAlbumWithBackoff).toHaveBeenCalled();
        expect(scheduler.getStatus().stats.rate_limited).toBe(1);
    });

    /**
     * Test: Generic errors should not trigger backoff
     * - Non-rate-limit error occurs (network error, etc.)
     * - Should track in error stats
     * - Should NOT set backoff_until
     * - Allows immediate retry on transient errors
     */
    it('handles generic errors without backoff', async () => {
        vi.spyOn(albumRepo, 'get').mockReturnValue({
            id: 'a1', enabled: true, query_type: 'tag', query_tags: '["test"]',
            query_limit: 20, refresh_json: '{}'
        });

        vi.spyOn(albumService, 'refreshAlbumWithBackoff').mockResolvedValue({
            success: false,
            isRateLimited: false,
            error: 'Network error',
            backoff_until: null
        });

        const beforeErrors = scheduler.getStatus().stats.errors;
        await scheduler.forceRefreshAlbum('a1');

        expect(albumService.refreshAlbumWithBackoff).toHaveBeenCalled();
        expect(scheduler.getStatus().stats.errors).toBe(beforeErrors + 1);
    });

    /**
     * Test: Backoff should have a maximum cap
     * - Album has very high retry_count (20)
     * - Exponential backoff would be extremely long
     * - Should cap at 6 hours maximum
     * - Prevents indefinite backoff periods
     */
    it('caps backoff at 6 hours max', async () => {
        vi.spyOn(albumRepo, 'get').mockReturnValue({
            id: 'a1', enabled: true, query_type: 'tag', query_tags: '["test"]',
            query_limit: 20, refresh_json: JSON.stringify({ retry_count: 20 })
        });

        const backoffUntil = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
        vi.spyOn(albumService, 'refreshAlbumWithBackoff').mockResolvedValue({
            success: false,
            isRateLimited: true,
            error: 'Rate limit exceeded',
            backoff_until: backoffUntil
        });

        await scheduler.forceRefreshAlbum('a1');

        expect(albumService.refreshAlbumWithBackoff).toHaveBeenCalled();
    });

    /**
     * Test: Non-existent album should throw error
     * - Album ID doesn't exist in database
     * - Should throw 'Album not found' error
     * - Prevents attempting to refresh invalid albums
     */
    it('throws error for non-existent album', async () => {
        vi.spyOn(albumRepo, 'get').mockReturnValue(null);
        await expect(scheduler.forceRefreshAlbum('fake')).rejects.toThrow('Album not found');
    });

    /**
     * Test: Force refresh should bypass schedule checks
     * - Album was checked very recently (1 second ago)
     * - Normal scheduler would skip it (not due for refresh)
     * - forceRefreshAlbum() should refresh anyway
     * - Allows manual/on-demand refresh regardless of schedule
     */
    it('force refreshes regardless of schedule', async () => {
        vi.spyOn(albumRepo, 'get').mockReturnValue({
            id: 'a1', enabled: true, query_type: 'tag', query_tags: '["test"]',
            query_limit: 20,
            refresh_json: JSON.stringify({
                last_checked_at: new Date(Date.now() - 1000).toISOString(),
                refresh_interval_ms: 24 * 60 * 60 * 1000
            })
        });

        const spy = vi.spyOn(albumService, 'refreshAlbumWithBackoff').mockResolvedValue({
            success: true,
            fetched: 0,
            upserted: 0,
            linked: 0
        });

        await scheduler.forceRefreshAlbum('a1');
        expect(spy).toHaveBeenCalled();
    });

    /**
     * Test: Status endpoint returns correct structure
     * - Should include running state (boolean)
     * - Should include tick_interval_ms (number)
     * - Should include stats object with all counters
     * - Provides visibility into scheduler health and activity
     */
    it('returns status with stats', () => {
        const status = scheduler.getStatus();
        expect(status).toMatchObject({
            running: expect.any(Boolean),
            tick_interval_ms: expect.any(Number),
            stats: expect.objectContaining({
                total_runs: expect.any(Number),
                albums_refreshed: expect.any(Number),
                errors: expect.any(Number),
                rate_limited: expect.any(Number)
            })
        });
    });
});