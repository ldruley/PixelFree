console.log('[PixelFree] app.js loaded');

window.addEventListener('error', e => console.error('Global error:', e.error || e.message));

const CAPTION_MAX_LENGTH = 60;

// ===== Element refs =====
const statusEl   = document.getElementById('status');
const loginBtn   = document.getElementById('loginBtn');
const logoutBtn  = document.getElementById('logoutBtn');

const tagsInput  = document.getElementById('tagsInput');
const usersInput = document.getElementById('usersInput');
const limitInput = document.getElementById('limitInput');
const searchBtn  = document.getElementById('searchBtn');
const tagmodeSelect = document.getElementById('tagmodeSelect');

const grid    = document.getElementById('imageGrid');        // required
const loading = document.getElementById('loadingIndicator'); // optional spinner
const empty   = document.getElementById('empty');            // optional empty-state

// ===== Helpers =====
async function getJSON(url, opts = {}) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function setLoading(isLoading) {
  document.body.classList.toggle('is-loading', isLoading);
  if (searchBtn) searchBtn.disabled = isLoading;
}

function splitList(str) {
  return String(str || '')
    .split(/[,\s]+/)          // commas or whitespace
    .map(s => s.trim())
    .filter(Boolean);
}

function normalizeTags(list) {
  // strip leading '#' and trim
  return list.map(t => t.replace(/^#/, '').trim()).filter(Boolean);
}

function normalizeAccts(list) {
  // Accept @user@host or profile URLs; return acct (user@host)
  return list
    .map(s => s.trim())
    .map(s => {
      if (/^https?:\/\//i.test(s)) {
        // try to extract acct from common profile URL patterns like https://host/@user
        try {
          const u = new URL(s);
          const match = u.pathname.match(/\/@([^/]+)/);
          if (match) return `${match[1]}@${u.hostname}`;
        } catch { /* ignore */ }
      }
      return s.startsWith('@') ? s.slice(1) : s; // drop leading '@' if present
    })
    .filter(Boolean);
}

function showNotice(message, kind = 'info') {
  let c = document.getElementById('notices');
  if (!c) {
    // Fallback: inject right after controls if the placeholder doesn't exist
    const controls = document.getElementById('controls') || document.querySelector('.controls');
    c = document.createElement('div');
    c.id = 'notices';
    c.setAttribute('aria-live', 'polite');
    if (controls && controls.parentElement) {
      controls.insertAdjacentElement('afterend', c);
    } else {
      document.body.prepend(c);
    }
  }

  const el = document.createElement('div');
  el.className = `notice ${kind}`;
  el.textContent = message;

  // click-to-dismiss
  el.style.cursor = 'pointer';
  el.title = 'Click to dismiss';
  el.addEventListener('click', () => el.remove());

  c.appendChild(el);

  // auto-remove after 8s
  setTimeout(() => el.remove(), 8000);
}

// ===== Auth =====
let isAuthenticated = false;

async function checkAuth() {
  try {
    statusEl && (statusEl.textContent = 'Checking auth...');
    const s = await getJSON('/api/auth/status');
    if (s.isAuthenticated) {
      isAuthenticated = true;
      statusEl && (statusEl.textContent = 'Authenticated');
      loginBtn && (loginBtn.hidden = true);
      logoutBtn && (logoutBtn.hidden = false);
      searchBtn && (searchBtn.disabled = false);
      searchBtn.title = "Run search";
    } else {
      isAuthenticated = false;
      statusEl && (statusEl.textContent = 'Not authenticated');
      loginBtn && (loginBtn.hidden = false);
      logoutBtn && (logoutBtn.hidden = true);
      searchBtn && (searchBtn.disabled = true);
      searchBtn.title = "Please log in first";
    }
  } catch (e) {
    console.error(e);
    isAuthenticated = false;
    statusEl && (statusEl.textContent = 'Error checking auth');
  }
}

async function login() {
  try {
    const { loginUrl } = await getJSON('/api/login');
    if (loginUrl) window.location.href = loginUrl;
  } catch (e) {
    console.error(e);
    alert('Login failed. See console for details.');
  }
}

async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    await checkAuth();
    clearGrid();
  } catch (e) {
    console.error(e);
  }
}

// ===== Photos (rendering) =====
function clearGrid() {
  if (grid) grid.innerHTML = '';
  if (empty) {
    empty.hidden = false;
    empty.textContent = 'No photos yet. Enter tags and/or users, then click “Search”.';
  }
}

function renderPhotos(photos) {
  grid.innerHTML = '';
  if (!photos.length) {
    if (empty) { empty.hidden = false; empty.textContent = 'No photos found.'; }
    return;
  }
  if (empty) empty.hidden = true;

  const frag = document.createDocumentFragment();

  for (const p of photos) {
    const card = document.createElement('div');
    card.className = 'card';

    // Create clickable wrapper (image + caption)
    const clickable = document.createElement('div');
    clickable.className = 'clickable-card';

    // Image
    const img = document.createElement('img');
    img.src = p.preview_url || p.url;
    img.loading = 'lazy';
    img.alt = (Array.isArray(p.tags) && p.tags.length) ? p.tags.join(', ') : 'photo';
    clickable.appendChild(img);

    // Caption
    const captionText = truncateText(htmlToText(p.caption || p.content || 'View details'), CAPTION_MAX_LENGTH);
    const caption = document.createElement('div');
    caption.className = 'caption';
    caption.textContent = captionText;
    clickable.appendChild(caption);

    // Unified click → popup with details
    clickable.addEventListener('click', () => {
      openInfoModal({
        captionHtml: p.caption || p.content || '',
        author: p.author || {},
        author_display_name: p.author_display_name || (p.author?.username),
        created_at: p.created_at,
        location: p.location,
        post_url: p.post_url || p.status_url,
        media_url: p.url
      });
    });

    card.appendChild(clickable);
    frag.appendChild(card);
  }

  grid.appendChild(frag);
}

// --- helpers for caption text ---
const htmlToText = (html) => {
  const tmp = document.createElement('div');
  tmp.innerHTML = html || '';
  return (tmp.textContent || tmp.innerText || '').trim();
};

const truncateText = (text, maxLength) => {
  if (!text) return '';
  return text.length > maxLength
    ? text.slice(0, maxLength - 1) + '…'
    : text;
};

function getLimit() {
  const v = Number(limitInput?.value || 7);
  const n = Number.isFinite(v) ? v : 7;
  return Math.max(1, Math.min(40, n));
}

function buildQueryBody() {
  const tags  = normalizeTags(splitList(tagsInput?.value));
  const accts = normalizeAccts(splitList(usersInput?.value));
  const limit = getLimit();
  const tagmode = (tags.length ? (tagmodeSelect?.value || 'any') : 'any').toLowerCase(); // only matters if tags present

  if (!tags.length && !accts.length) {
    alert('Please enter at least one tag or one user.');
    return null;
  }

  if (tags.length && accts.length) {
    return { type: 'compound', tags, users: { accts }, limit, tagmode };
  } else if (tags.length) {
    return { type: 'tag', tags, limit, tagmode };
  } else {
    return { type: 'user', accts, limit };
  }
}

// --- Modal control ---
const modal = document.getElementById('infoModal');
const modalBackdrop = modal?.querySelector('.modal-backdrop');
const modalClose = document.getElementById('modalClose');
const modalContent = document.getElementById('modalContent');

function openInfoModal(info) {
  if (!modal || !modalContent) return;
  const dateStr = info.created_at ? new Date(info.created_at).toLocaleString() : '—';
  const byline = info.author_display_name || info.author?.username || 'Unknown';
  const loc = info.location ? formatLocation(info.location) : '—';

  modalContent.innerHTML = `
    ${info.media_url ? `
      <div class="row" style="text-align:center; margin-bottom:10px;">
        <a href="${info.media_url}" target="_blank" rel="noopener">
          <img src="${info.media_url}" alt="media" style="max-width:100%; max-height:300px; border-radius:4px;" />
        </a>
      </div>
    ` : ''}
    <div class="row"><strong>By:</strong> <span>${escapeHtml(byline)}</span></div>
    <div class="row"><strong>When:</strong> <span>${escapeHtml(dateStr)}</span></div>
    <div class="row"><strong>Location:</strong> <span>${escapeHtml(loc)}</span></div>
    ${info.post_url ? `<div class="row"><strong>Post:</strong> <a href="${info.post_url}" target="_blank" rel="noopener">${info.post_url}</a></div>` : ''}
    <div style="margin-top:10px; border-top:1px solid var(--border); padding-top:10px;">
      ${info.captionHtml || '<em>No caption</em>'}
    </div>
  `;
  modal.hidden = false;
}

function closeInfoModal() { if (modal) modal.hidden = true; }

modalClose?.addEventListener('click', closeInfoModal);
modalBackdrop?.addEventListener('click', closeInfoModal);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeInfoModal();
});

function escapeHtml(str='') {
  return String(str)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#39;');
}

function formatLocation(loc) {
  // Handle either a simple string or an object { name, city, country, ... }
  if (typeof loc === 'string') return loc;
  if (loc && typeof loc === 'object') {
    return [loc.name, loc.city, loc.region, loc.country].filter(Boolean).join(', ') || '—';
  }
  return '—';
}

// ===== Advanced query against /api/photos/query =====
async function runSearch() {
  if (!isAuthenticated) {
    alert('Please log in before searching.');
    return;
  }

  const body = buildQueryBody();
  if (!body) return;

  setLoading(true);
  if (empty) empty.hidden = true;
  if (grid) grid.innerHTML = '';

  try {
    const res = await fetch('/api/photos/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    // Try to parse a structured payload no matter what
    const payload = await res.json().catch(() => null);

    if (!res.ok) {
      // Structured error from errorMapper: { error, code, status, details, correlationId }
      if (payload && payload.code) {
        const friendly = ({
          validation_error: 'Problem with user or tag. Please review your input.',
          not_found:        'We could not find one of the requested accounts.',
          rate_limited:     'You’re doing that too quickly. Please try again shortly.',
          upstream_error:   'The remote server had a problem. Try again later.',
          internal_error:   'Something went wrong on our side.',
        })[payload.code] || payload.error || res.statusText;

        // Add more context if available (e.g., which acct failed)
        if (payload.details?.acct) {
          showNotice(`${friendly} (${payload.details.acct})`, 'error');
        } else {
          showNotice(friendly, 'error');
        }
      } else {
        showNotice('Search failed. Please try again.', 'error');
      }
      return;
    }

    // Success path: may be an array OR an object { photos, errors }
    let photos = [];
    let partialErrors = [];

    if (Array.isArray(payload)) {
      photos = payload;
    } else if (payload && typeof payload === 'object') {
      photos = Array.isArray(payload.photos) ? payload.photos : [];
      partialErrors = Array.isArray(payload.errors) ? payload.errors : [];
    }

    renderPhotos(Array.isArray(photos) ? photos : []);

    // Surface any per-item errors politely (partial success)
    if (partialErrors.length) {
      const msg = partialErrors.slice(0, 3).map(e => {
        // e: { target, code, message }
        const short = ({
          validation_error: 'invalid input',
          not_found:        'not found',
          rate_limited:     'rate limited',
          upstream_error:   'upstream error',
        })[e.code] || 'error';
        return `${e.target || 'item'}: ${short}`;
      }).join('; ');
      const more = partialErrors.length > 3 ? ` (+${partialErrors.length - 3} more)` : '';
      showNotice(`Some items were skipped: ${msg}${more}`, 'warn');
    }

  } catch (e) {
    console.error(e);
    showNotice('Search failed. Please try again.', 'error');
  } finally {
    setLoading(false);
  }
}

// ===== Wire up events =====
loginBtn  && loginBtn.addEventListener('click', login);
logoutBtn && logoutBtn.addEventListener('click', logout);
searchBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  runSearch().catch(console.error);
});

// Submit on Enter in any field (only if authenticated)
[tagsInput, usersInput, limitInput].forEach(el => {
  el?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!isAuthenticated) {
        alert('Please log in before running a search.');
        loginBtn?.focus();
        return;
      }
      runSearch().catch(console.error);
    }
  });
});

// ===== Launch =====
setLoading(false);
checkAuth();
clearGrid(); // show initial hint
