import type { RunState } from '../store/run-state';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const RESULT_LABELS: Record<string, { label: string; color: string }> = {
  posted: { label: 'Posted', color: '#16a34a' },
  skipped: { label: 'Skipped (already posted)', color: '#ca8a04' },
  failed: { label: 'Failed', color: '#dc2626' },
  dry_run: { label: 'Dry Run', color: '#6366f1' },
};

export function buildDashboardHtml(state: RunState | null): string {
  const resultInfo = state
    ? RESULT_LABELS[state.lastRunResult] ?? { label: state.lastRunResult, color: '#737373' }
    : null;

  const statusRows = state
    ? `
        <div class="row">
          <span class="label">Last run</span>
          <span class="value">${esc(new Date(state.lastRunAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }))}</span>
        </div>
        <div class="row">
          <span class="label">Result</span>
          <span class="badge" style="background:${resultInfo!.color}">${esc(resultInfo!.label)}</span>
        </div>
        ${state.lastPostedTitle ? `
        <div class="row">
          <span class="label">Last posted</span>
          <span class="value">${state.lastPostedUrl ? `<a href="${esc(state.lastPostedUrl)}" target="_blank" rel="noopener">${esc(state.lastPostedTitle)}</a>` : esc(state.lastPostedTitle)}</span>
        </div>` : ''}
        ${state.lastError ? `
        <div class="row">
          <span class="label">Error</span>
          <span class="value error">${esc(state.lastError)}</span>
        </div>` : ''}
      `
    : '<p class="empty">No runs recorded yet.</p>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Reddit Poster Worker</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,-apple-system,sans-serif;background:#0f0f0f;color:#e5e5e5;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;padding:1.5rem}
    .card{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:2rem;max-width:480px;width:100%;box-shadow:0 4px 24px rgba(0,0,0,.4)}
    h1{font-size:1.25rem;font-weight:600;margin-bottom:1.5rem;color:#fff}
    h1 span{color:#ff4500}
    h2{font-size:.9rem;font-weight:600;color:#a3a3a3;margin-bottom:1rem;text-transform:uppercase;letter-spacing:.05em}
    .row{display:flex;justify-content:space-between;align-items:center;padding:.75rem 0;border-bottom:1px solid #2a2a2a}
    .row:last-child{border-bottom:none}
    .label{font-size:.85rem;color:#a3a3a3;flex-shrink:0;margin-right:1rem}
    .value{font-size:.85rem;text-align:right;word-break:break-word}
    .value a,.post-link{color:#60a5fa;text-decoration:none}
    .value a:hover,.post-link:hover{text-decoration:underline}
    .badge{font-size:.75rem;font-weight:600;color:#fff;padding:.2rem .6rem;border-radius:999px}
    .error{color:#f87171}
    .empty{color:#737373;font-size:.9rem;text-align:center;padding:1rem 0}
    .footer{margin-top:1.5rem;display:flex;justify-content:space-between;align-items:center;font-size:.75rem;color:#525252}
    .footer a{color:#525252}
    .refresh-btn{background:none;border:1px solid #3a3a3a;color:#a3a3a3;border-radius:6px;padding:.25rem .6rem;font-size:.75rem;cursor:pointer}
    .refresh-btn:hover{border-color:#525252;color:#e5e5e5}
    .post-item{padding:.6rem 0;border-bottom:1px solid #2a2a2a;display:flex;justify-content:space-between;align-items:baseline;gap:.75rem}
    .post-item:last-child{border-bottom:none}
    .post-title{font-size:.85rem;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .post-age{font-size:.75rem;color:#737373;flex-shrink:0}
    #posts-list .empty{padding:.5rem 0}
  </style>
</head>
<body>
  <div class="card">
    <h1><span>r/DHSavagery</span> Poster</h1>
    ${statusRows}
    <div class="footer">
      <a href="/api/status">JSON</a>
      <a href="/logout">Sign out</a>
    </div>
  </div>

  <div class="card">
    <h2>Recent posts</h2>
    <div id="posts-list"><p class="empty">Loading…</p></div>
    <div class="footer">
      <span id="posts-updated"></span>
      <button class="refresh-btn" onclick="loadPosts()">Refresh</button>
    </div>
  </div>

  <script>
    function timeAgo(utcSecs) {
      const diff = Math.floor(Date.now() / 1000) - utcSecs;
      if (diff < 60) return diff + 's ago';
      if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
      if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
      return Math.floor(diff / 86400) + 'd ago';
    }

    async function loadPosts() {
      const list = document.getElementById('posts-list');
      const updated = document.getElementById('posts-updated');
      list.innerHTML = '<p class="empty">Loading…</p>';
      try {
        const res = await fetch('/api/posts');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const posts = await res.json();
        if (!posts.length) {
          list.innerHTML = '<p class="empty">No posts found.</p>';
        } else {
          list.innerHTML = posts.map(p =>
            '<div class="post-item">' +
              '<span class="post-title"><a class="post-link" href="' + p.permalink + '" target="_blank" rel="noopener">' + p.title.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</a></span>' +
              '<span class="post-age">' + timeAgo(p.createdUtc) + '</span>' +
            '</div>'
          ).join('');
        }
        updated.textContent = 'Updated ' + new Date().toLocaleTimeString();
      } catch (e) {
        list.innerHTML = '<p class="empty error">Failed to load posts: ' + e.message + '</p>';
      }
    }

    loadPosts();
  </script>
</body>
</html>`;
}
