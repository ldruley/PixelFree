/**
 * health.js
 *
 * Express route handler for application health checks.
 * Provides endpoints to verify the API is online and functioning,
 * typically used by monitoring tools or load balancers.
 */

import { stats as cacheStats } from './cache.js';

export async function getHealth() {
  const uptimeSec = Math.floor(process.uptime());
  const cache = await cacheStats();
  return { ok: true, uptimeSec, cache };
}
