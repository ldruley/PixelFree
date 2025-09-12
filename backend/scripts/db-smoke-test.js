// backend/scripts/db-smoke-test.js
// Run with:  node backend/scripts/db-smoke-test.js
// Requires:  npm i better-sqlite3
// Optional:  set PIXELFREE_DB_PATH to control where the DB file is created.

import * as albumRepo from '../db/albumRepo.js';
import * as photoRepo from '../db/photoRepo.js';
import * as kv from '../db/kvRepo.js';

function log(title, data) {
  console.log(`\n=== ${title} ===`);
  console.log(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
}

async function main() {
  // 0) Test Key-Value store
  console.log('\n[KV TEST]');
  kv.set('schema_version', '1');
  kv.set('last_cleanup_at', new Date().toISOString());

  console.log('All KV entries:', kv.list());
  console.log('schema_version:', kv.get('schema_version'));
  console.log('missing key fallback:', kv.get('nope', 'default-value'));

  kv.remove('schema_version');
  console.log('After remove:', kv.list());

  // 1) Create a test album
  const album = albumRepo.create({
    name: 'DB Smoke Test Album',
    query: {
      type: 'tag',
      tags: ['retrocomputing', 'classicmac'],
      tagmode: 'any',
      limit: 10
    },
    refresh: { intervalMs: 600000 }, // 10 min
    enabled: true
  });

  log('Created album', album);

  // 2) Upsert a few fake/normalized photos (as your fetcher would produce)
  const photos = [
    {
      id: 'status_001',
      status_id: 'status_001',           // either id or status_id is fine
      created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 min ago
      author: {
        id: 'acct_001',
        acct: 'bitsplusatoms@mastodon.social',
        username: 'bitsplusatoms',
        display_name: 'B+A',
        avatar: 'https://example.com/avatar1.png'
      },
      author_display_name: 'B+A',
      caption: '<p>Classic Mac love ❤️</p>',
      post_url: 'https://example.com/p/001',
      tags: ['retrocomputing', 'classicmac'],
      url: 'https://example.com/media/001-full.jpg',
      preview_url: 'https://example.com/media/001-prev.jpg'
    },
    {
      id: 'status_002',
      status_id: 'status_002',
      created_at: new Date(Date.now() - 1000 * 60 * 20).toISOString(), // 20 min ago
      author: {
        id: 'acct_002',
        acct: 'alice@example.com',
        username: 'alice',
        display_name: 'Alice',
        avatar: 'https://example.com/avatar2.png'
      },
      author_display_name: 'Alice',
      caption: '<p>Another retro post</p>',
      post_url: 'https://example.com/p/002',
      tags: ['retrocomputing'],
      url: 'https://example.com/media/002-full.jpg',
      preview_url: 'https://example.com/media/002-prev.jpg'
    },
    {
      id: 'status_003',
      status_id: 'status_003',
      created_at: new Date(Date.now() - 1000 * 60 * 10).toISOString(), // 10 min ago
      author: {
        id: 'acct_003',
        acct: 'bob@example.net',
        username: 'bob',
        display_name: 'Bob',
        avatar: 'https://example.com/avatar3.png'
      },
      author_display_name: 'Bob',
      caption: '<p>VCF West memories</p>',
      post_url: 'https://example.com/p/003',
      tags: ['vcfwest', 'retrocomputing'],
      url: 'https://example.com/media/003-full.jpg',
      preview_url: 'https://example.com/media/003-prev.jpg'
    }
  ];

  const upserted = photoRepo.upsertMany(photos);
  log('Upserted photos (count returned when implemented)', upserted ?? '(no count returned)');

  // 3) Link those photos into the album (album_items join)
  const statusIds = photos.map(p => p.status_id);
  albumRepo.addPhotos(album.id, statusIds);
  log('Linked status_ids to album', { albumId: album.id, statusIds });

  // 4) List photos for the album (ordered newest-first by added_at)
  const { items, total, offset, limit } = photoRepo.listForAlbum(album.id, { offset: 0, limit: 20 });
  log('Queried photos for album', { total, offset, limit });
  log('First item (sample)', items[0] || '(none)');

  // 5) Update album name, then fetch it back
  const updated = albumRepo.update(album.id, { name: 'DB Smoke Test Album (Renamed)' });
  log('Updated album', updated);

  // 6) List albums
  const list = albumRepo.list({ offset: 0, limit: 10 });
  log('List albums', list);

  // 7) Optional cleanup
  // albumRepo.remove(album.id);
  // log('Deleted album', album.id);

  console.log('\n✅ DB smoke test completed.');
}

main().catch(err => {
  console.error('Smoke test failed:', err);
  process.exit(1);
});