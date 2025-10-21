import { describe, it, expect } from 'vitest';
import {AppError, ValidationError, NotFoundError, RateLimitError, UpstreamError,} from '../modules/errors.js';
// Base typed error for the app (HTTP-ish).
describe('errors.js', () => {
    it('AppError sets fields', () => {
        const e = new AppError('msg', 'code', 418, { a: 1 });
        expect(e.message).toBe('msg');
        expect(e.code).toBe('code');
        expect(e.status).toBe(418);
        expect(e.meta).toEqual({ a: 1 });
        expect(e.name).toBe('AppError');
    });

    it('specialized errors set status and code', () => {
        // 400 – input failed validation ,missing data
        expect(new ValidationError('x').status).toBe(400);
        // 404 – the requested resource doesn’t exist
        expect(new NotFoundError('x').status).toBe(404);
        // 429 – upstream rate limited the request
        expect(new RateLimitError('x', {}).status).toBe(429);
        // 502 – network problem contacting a remote service
        expect(new UpstreamError('x').status).toBe(502);
    });
});