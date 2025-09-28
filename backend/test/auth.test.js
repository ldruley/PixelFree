import { describe, it, expect, beforeEach, vi} from 'vitest';

vi.mock('fs', () => {
    const mem = new Map();

    const api = {
        readFileSync(p) {
            if (!mem.has(p)) { const err = new Error('ENOENT'); err.code = 'ENOENT'; throw err; }
            return mem.get(p);
        },
        writeFileSync(p, data) { mem.set(p, typeof data === 'string' ? data : String(data)); },
        unlinkSync(p) { mem.delete(p); },
        existsSync(p) { return mem.has(p); },
        __mem: mem,
    };

    return { ...api, default: api };
});

const fs = await import('fs');

// Ensure env *before* importing the module under test
process.env.PIXELFED_INSTANCE = 'https://example.com';
process.env.PIXELFED_CLIENT_ID = 'id';
process.env.PIXELFED_CLIENT_SECRET = 'sec';
process.env.PIXELFED_REDIRECT_URI = 'http://localhost/cb';

beforeEach(() => {
    // Clear spies between tests, keep module mocks
    vi.clearAllMocks();
});

// Import after mocks/env
const authMod = await import('../modules/auth.js');

const path = await import('path');
const TOKEN_PATH = path.resolve('.token.json');

function writeToken(obj) { fs.writeFileSync(TOKEN_PATH, JSON.stringify(obj)); }
function readToken() { try { return JSON.parse(fs.readFileSync(TOKEN_PATH)); } catch { return null; } }

describe('auth.js', () => {
    it('getLoginUrl constructs correct URL', () => {
        const url = authMod.getLoginUrl();
        expect(url).toContain('https://example.com/oauth/authorize');
        expect(url).toContain('client_id=id');
        expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%2Fcb');
    });
    it('handleCallback exchanges code and writes token', async () => {
        vi.spyOn(global, 'fetch').mockResolvedValueOnce({
            ok: true,
            json: async () => ({ access_token: 'A', refresh_token: 'R', expires_in: 3600, created_at: 111 })
        });
        const res = await authMod.handleCallback({ code: 'xyz' });
        expect(res.ok).toBe(true);
        const t = readToken();
        expect(t.access_token).toBe('A');
        expect(t.refresh_token).toBe('R');
    });

    it('getStatus unauthenticated vs authenticated', () => {
        fs.unlinkSync(TOKEN_PATH);
        expect(authMod.getStatus().authenticated ?? authMod.getStatus().isAuthenticated).toBeFalsy();
        writeToken({ access_token: 'A', refresh_token: 'R', expires_in: 10, created_at: Math.floor(Date.now()/1000) });
        expect(authMod.getStatus().isAuthenticated).toBe(true);
    });

    it('logout removes token file', () => {
        writeToken({ a: 1 });
        authMod.logout();
        expect(readToken()).toBeNull();
    });

    it('getAccessToken returns valid token or refreshes', async () => {
        const now = Math.floor(Date.now()/1000);

        writeToken({ access_token: 'A', refresh_token: 'R', expires_in: 3600, created_at: now });
        expect(await authMod.getAccessToken()).toBe('A');

        writeToken({ access_token: 'OLD', refresh_token: 'R', expires_in: 60, created_at: now - 59 });
        vi.spyOn(global, 'fetch').mockResolvedValueOnce({
            ok: true,
            json: async () => ({ access_token: 'NEW', refresh_token: 'NR', expires_in: 3600 })
        });
        const tok = await authMod.getAccessToken();
        expect(tok).toBe('NEW');
    });

    it('getAccessToken refresh failure clears token', async () => {
        writeToken({ access_token: 'A', refresh_token: 'R', expires_in: 0, created_at: 0 });
        vi.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: false, json: async () => ({ err: 'fail' }) });
        await expect(authMod.getAccessToken()).rejects.toThrow('Refresh failed');
        expect(readToken()).toBeNull();
    });
});