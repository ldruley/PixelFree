// scripts/simulateAlbumClient.js
// Simulates a frontend workflow for creating an album with tags ["italy","travel"] (tagmode=all),
// refreshing it, and then fetching/displaying the first page of photos.
// Requires Node 18+ (global fetch).
// Usage:
//   node scripts/simulateAlbumClient.js
//
// Assumes the PixelFree backend is running locally on http://localhost:3000
// and that the Albums API is available and protected by auth.
//
// What it does:
// 1) Checks auth; if not authenticated, prints a login URL and polls until authenticated.
// 2) Creates (or finds) an album named "Italy + Travel (sim)" with tagmode=all and no user restriction.
// 3) Triggers a manual refresh on that album.
// 4) Fetches the first page of photos and prints a concise summary to the console.

const BASE = process.env.PF_BASE || 'http://localhost:3000';
const ALBUM_NAME = process.env.PF_ALBUM_NAME || 'Italy + Travel (sim)';
// Tags to query (comma-separated in PF_TAGS)
const TAGS = (process.env.PF_TAGS || 'italy,travel')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const TAG_MODE = process.env.PF_TAG_MODE || 'all'; // 'all' | 'any'

// Users to query (comma-separated in PF_USERS)
const USERS = (process.env.PF_USERS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const PAGE_LIMIT = Number(process.env.PF_PAGE_LIMIT || 24);

async function getJSON(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`GET ${path} failed: ${res.status} ${res.statusText} ${txt}`);
  }
  return res.json();
}

async function postJSON(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`POST ${path} failed: ${res.status} ${res.statusText} ${txt}`);
  }
  return res.json();
}

async function ensureAuthenticated({ maxWaitMs = 120000, intervalMs = 3000 } = {}) {
  const start = Date.now();
  let printedLogin = false;

  console.log(`[auth] Checking ${BASE}/api/auth/status ...`);
  while (true) {
    let status;
    try {
      status = await getJSON('/api/auth/status');
    } catch (e) {
      console.log('[auth] status fetch failed:', e.message);
    }
    console.log('[auth] status payload:', JSON.stringify(status));

    if (status?.isAuthenticated) {
      console.log('✅ Authenticated');
      return true;
    }

    // Only fetch/print login URL once per loop if we’re not authenticated
    if (!printedLogin) {
      try {
        const login = await getJSON('/api/login');
        console.log('[auth] login payload:', JSON.stringify(login));
        if (login?.loginUrl) {
          console.log('\nYou are not authenticated.');
          console.log('Open this URL in your browser to sign in, then return here:');
          console.log('  ', login.loginUrl, '\n');
          printedLogin = true;
        }
      } catch (e) {
        console.log('[auth] login fetch failed:', e.message);
      }
    }

    if (Date.now() - start > maxWaitMs) {
      throw new Error('Timed out waiting for authentication. Please log in and re-run.');
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
}

async function findOrCreateAlbum() {
  // Try to find an existing album with the same name
  const all = await getJSON('/api/albums').catch(() => []);
  const existing = Array.isArray(all?.items) ? all.items.find(a => a.name === ALBUM_NAME) : null;
  if (existing) {
    console.log(`ℹ️  Using existing album: ${existing.id} "${existing.name}"`);
    return existing;
  }

  console.log('Creating album…');
  // Decide query type dynamically
  let queryType = 'compound';
  if (TAGS.length && !USERS.length) {
    queryType = 'tag';
  } else if (!TAGS.length && USERS.length) {
    queryType = 'user';
  }

  // Build the request body
  const created = await postJSON('/api/albums', {
    name: ALBUM_NAME,
    query: {
      type: queryType,
      tags: TAGS,
      users: {
        accountIds: USERS || [],
        accts: []
      },
      tagmode: TAG_MODE
    },
    refresh_interval_ms: 15 * 60 * 1000
  });
  console.log(`✅ Created album: ${created.id} "${created.name}"`);
  return created;
}

async function refreshAlbum(id) {
  console.log('Refreshing album now…');
  const r = await postJSON(`/api/albums/${id}/refresh`, {});
  if (r && typeof r === 'object' && ('fetched' in r || 'inserted' in r || 'linked' in r)) {
    console.log(`✅ Refresh complete (fetched=${r.fetched ?? '?'}, inserted=${r.inserted ?? '?'}, linked=${r.linked ?? '?'})`);
    return r;
  }
  console.log('✅ Refresh complete.');
  return r;
}

async function fetchFirstPage(id, limit = PAGE_LIMIT) {
  const qs = new URLSearchParams({ offset: '0', limit: String(limit) });
  const res = await getJSON(`/api/albums/${id}/photos?${qs.toString()}`);
  const items = Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : []);
  console.log(`\n📸 Received ${items.length} photos (limit ${limit}).`);
  items.forEach((p, i) => {
    const who = p.author?.acct || p.author?.username || 'unknown';
    const when = p.created_at || '';
    const tags = Array.isArray(p.tags) ? p.tags.join(',') : '';
    const src = p.local_path ? '(local)' : (p.preview_url ? '(preview)' : '(remote)');
    console.log(
      `${String(i+1).padStart(2,' ')}. id=${p.status_id || p.id} ${src} ` +
      `by=${who} at=${when} tags=[${tags}]`
    );
  });
  return items;
}

async function main() {
  console.log(`PixelFree simulate client → ${BASE}`);
  await ensureAuthenticated();

  const album = await findOrCreateAlbum();
  await refreshAlbum(album.id);
  await fetchFirstPage(album.id, PAGE_LIMIT);

  console.log('\n✅ Simulation complete.');
}

main().catch(err => {
  console.error('❌ Simulation failed:', err?.message || err);
  process.exit(1);
});