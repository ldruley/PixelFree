/**
 * errors.js
 *
 * Centralized error definitions and handling utilities for the backend.
 * Provides a consistent way to create, format, and propagate errors
 * across services, including standard error types with HTTP status codes.
 */

export class AppError extends Error {
  /** @param {string} message @param {string} code @param {number} status @param {object} [meta] */
  constructor(message, code = 'internal_error', status = 500, meta = undefined) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.status = status;
    this.meta = meta;
  }
}

export class ValidationError extends AppError {
  constructor(message, meta) { super(message, 'validation_error', 400, meta); }
}
export class NotFoundError extends AppError {
  constructor(message, meta) { super(message, 'not_found', 404, meta); }
}
export class RateLimitError extends AppError {
  /** @param {string} message @param {{ retryAfter?:number, [k:string]:any }} meta */
  constructor(message, meta) { super(message, 'rate_limited', 429, meta); }
}
export class UpstreamError extends AppError {
  constructor(message, meta) { super(message, 'upstream_error', 502, meta); }
}