/**
 * HTTP utilities for the backend.
 *
 * Provides helper functions to standardize and simplify HTTP-related logic,
 * including consistent JSON response formatting, error handling, and status
 * code usage across Express route handlers. These utilities ensure that API
 * responses follow a predictable structure, reducing duplication and improving
 * maintainability throughout the application.
 */

/**
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{ retries?:number, baseDelayMs?:number, retryOn?: (e:any)=>boolean }} [opts]
 * @returns {Promise<T>}
 */
export async function withRetry(fn, opts = {}) {
  const retries = Number.isInteger(opts.retries) ? opts.retries : 3;
  const base = opts.baseDelayMs ?? 300;
  const retryOn = opts.retryOn || ((e) => {
    const s = Number(e?.status || 0);
    return s === 429 || (s >= 500 && s <= 599);
  });

  let attempt = 0;
  let lastErr;
  while (attempt <= retries) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt === retries || !retryOn(e)) throw e;
      const delay = Math.round(base * Math.pow(2, attempt) + Math.random() * 100);
      await new Promise(r => setTimeout(r, delay));
      attempt++;
    }
  }
  throw lastErr;
}
