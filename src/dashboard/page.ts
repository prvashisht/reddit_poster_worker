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
  skipped: { label: 'Skipped', color: '#ca8a04' },
  failed: { label: 'Failed', color: '#dc2626' },
  dry_run: { label: 'Dry Run', color: '#6366f1' },
  comment_added: { label: 'Comment Added', color: '#0ea5e9' },
  comment_skipped: { label: 'Comment Exists', color: '#525252' },
};

const COMMENT_LABELS: Record<string, { label: string; color: string }> = {
  posted: { label: 'Comment ✓', color: '#16a34a' },
  failed: { label: 'Comment ✗', color: '#dc2626' },
  skipped: { label: 'No comment', color: '#525252' },
};

function badge(label: string, color: string): string {
  return `<span class="badge" style="background:${color}">${esc(label)}</span>`;
}

function formatDate(iso: string): string {
  return esc(new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
}

function buildLatestCard(state: RunState): string {
  const resultInfo = RESULT_LABELS[state.lastRunResult] ?? { label: state.lastRunResult, color: '#737373' };
  const sourceLabel = state.source === 'manual' ? ' <span class="source-tag">manual</span>' : '';

  return `
    <div class="row">
      <span class="label">Last run</span>
      <span class="value">${formatDate(state.lastRunAt)}${sourceLabel}</span>
    </div>
    <div class="row">
      <span class="label">Result</span>
      <span style="display:flex;gap:.4rem;align-items:center">
        ${badge(resultInfo.label, resultInfo.color)}
        ${state.commentResult ? badge(COMMENT_LABELS[state.commentResult].label, COMMENT_LABELS[state.commentResult].color) : ''}
      </span>
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
    </div>` : ''}`;
}

function buildHistoryRows(history: RunState[]): string {
  if (!history.length) return '<p class="empty">No history yet.</p>';

  return history
    .map((entry) => {
      const resultInfo = RESULT_LABELS[entry.lastRunResult] ?? { label: entry.lastRunResult, color: '#737373' };
      const commentInfo = entry.commentResult ? COMMENT_LABELS[entry.commentResult] : null;
      const sourceTag = entry.source === 'manual' ? ' <span class="source-tag">manual</span>' : '';
      return `
        <div class="history-row">
          <span class="history-time">${formatDate(entry.lastRunAt)}${sourceTag}</span>
          <span style="display:flex;gap:.35rem;align-items:center;flex-shrink:0">
            ${badge(resultInfo.label, resultInfo.color)}
            ${commentInfo ? badge(commentInfo.label, commentInfo.color) : ''}
          </span>
        </div>`;
    })
    .join('');
}

export function buildDashboardHtml(history: RunState[]): string {
  const state = history[0] ?? null;

  const statusRows = state ? buildLatestCard(state) : '<p class="empty">No runs recorded yet.</p>';
  const historyRows = buildHistoryRows(history);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Reddit Savage Bot Dashboard</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,-apple-system,sans-serif;background:#0f0f0f;color:#e5e5e5;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;padding:1.5rem}
    .card{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:2rem;max-width:520px;width:100%;box-shadow:0 4px 24px rgba(0,0,0,.4)}
    h1{font-size:1.25rem;font-weight:600;margin-bottom:1.5rem;color:#fff}
    h1 span{color:#ff4500}
    h2{font-size:.9rem;font-weight:600;color:#a3a3a3;margin-bottom:1rem;text-transform:uppercase;letter-spacing:.05em}
    .row{display:flex;justify-content:space-between;align-items:center;padding:.75rem 0;border-bottom:1px solid #2a2a2a}
    .row:last-child{border-bottom:none}
    .label{font-size:.85rem;color:#a3a3a3;flex-shrink:0;margin-right:1rem}
    .value{font-size:.85rem;text-align:right;word-break:break-word}
    .value a,.post-link{color:#60a5fa;text-decoration:none}
    .value a:hover,.post-link:hover{text-decoration:underline}
    .badge{font-size:.75rem;font-weight:600;color:#fff;padding:.2rem .6rem;border-radius:999px;white-space:nowrap}
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
    .run-btn{background:#ff4500;border:none;color:#fff;border-radius:8px;padding:.5rem 1.1rem;font-size:.85rem;font-weight:600;cursor:pointer;transition:background .15s}
    .run-btn:hover:not(:disabled){background:#e03d00}
    .run-btn:disabled{opacity:.5;cursor:not-allowed}
    .run-result{margin-top:.85rem;padding:.6rem .85rem;border-radius:8px;font-size:.82rem;background:#2a2a2a;word-break:break-word;display:none}
    .run-result.visible{display:block}
    .source-tag{display:inline-block;font-size:.65rem;font-weight:600;color:#a78bfa;background:#2e1065;border-radius:4px;padding:.1rem .35rem;margin-left:.35rem;vertical-align:middle}
    .history-row{display:flex;justify-content:space-between;align-items:center;padding:.55rem 0;border-bottom:1px solid #2a2a2a;gap:.75rem}
    .history-row:last-child{border-bottom:none}
    .history-time{font-size:.8rem;color:#a3a3a3;min-width:0;flex:1}
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
    <h2>Run manually</h2>
    <p style="font-size:.82rem;color:#737373;margin-bottom:1rem">Runs the bot now with the same duplicate check as the scheduled job — will skip if today's Speakout is already posted.</p>
    <div style="display:flex;gap:.75rem;align-items:center;flex-wrap:wrap">
      <button class="run-btn" id="run-btn" onclick="triggerRun(false)">Run Now</button>
      <button class="run-btn" id="dry-btn" style="background:#6366f1" onclick="triggerRun(true)" title="Fetches the latest Speakout and checks if it would post, but does not actually post anything">Dry Run (no post)</button>
    </div>
    <div class="run-result" id="run-result"></div>
  </div>

  <div class="card">
    <h2>Fix missing comment</h2>
    <p style="font-size:.82rem;color:#737373;margin-bottom:1rem">Checks if the latest post already has a source comment from the bot, and adds one if not.</p>
    <button class="run-btn" id="comment-btn" style="background:#0ea5e9" onclick="triggerComment()">Add Source Comment</button>
    <div class="run-result" id="comment-result"></div>
  </div>

  <div class="card">
    <h2>Run history</h2>
    <div id="history-list">${historyRows}</div>
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

    async function triggerRun(dryRun) {
      const btn = document.getElementById(dryRun ? 'dry-btn' : 'run-btn');
      const otherBtn = document.getElementById(dryRun ? 'run-btn' : 'dry-btn');
      const resultEl = document.getElementById('run-result');

      btn.disabled = true;
      otherBtn.disabled = true;
      btn.textContent = dryRun ? 'Running…' : 'Running…';
      resultEl.className = 'run-result';
      resultEl.textContent = '';

      try {
        const res = await fetch('/api/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dryRun }),
        });
        const data = await res.json();

        const RESULT_COLORS = { posted: '#16a34a', skipped: '#ca8a04', failed: '#dc2626', dry_run: '#6366f1' };
        const RESULT_LABELS = { posted: 'Posted', skipped: 'Skipped', failed: 'Failed', dry_run: 'Dry Run' };
        const color = RESULT_COLORS[data.lastRunResult] || '#737373';
        const label = RESULT_LABELS[data.lastRunResult] || data.lastRunResult;

        let msg = label;
        if (data.lastPostedTitle) msg += ' — ' + data.lastPostedTitle;
        if (data.lastError) msg += '\\nError: ' + data.lastError;
        if (data.commentResult === 'failed') msg += '\\n⚠ Comment failed to post';

        resultEl.style.borderLeft = '3px solid ' + color;
        resultEl.style.color = color === '#dc2626' ? '#f87171' : '#e5e5e5';
        resultEl.textContent = msg;
        resultEl.className = 'run-result visible';

        // reload page after a short delay so history + status refresh
        setTimeout(() => location.reload(), 1500);
      } catch (e) {
        resultEl.style.borderLeft = '3px solid #dc2626';
        resultEl.style.color = '#f87171';
        resultEl.textContent = 'Request failed: ' + e.message;
        resultEl.className = 'run-result visible';
      } finally {
        btn.disabled = false;
        otherBtn.disabled = false;
        btn.textContent = dryRun ? 'Dry Run' : 'Run Now';
      }
    }

    async function triggerComment() {
      const btn = document.getElementById('comment-btn');
      const resultEl = document.getElementById('comment-result');
      btn.disabled = true;
      btn.textContent = 'Checking…';
      resultEl.className = 'run-result';

      try {
        const res = await fetch('/api/comment', { method: 'POST' });
        const data = await res.json();
        const MESSAGES = {
          commented: { text: "Source comment posted successfully.", color: "#16a34a" },
          already_exists: { text: "Comment already exists — nothing to do.", color: "#ca8a04" },
          title_mismatch: { text: "Latest post doesn't match today's Speakout: " + (data.latestPostTitle || ""), color: "#ca8a04" },
          failed: { text: "Failed: " + (data.error || "unknown error"), color: "#dc2626" },
        };
        const info = MESSAGES[data.status] || { text: JSON.stringify(data), color: '#737373' };
        resultEl.style.borderLeft = '3px solid ' + info.color;
        resultEl.style.color = info.color === '#dc2626' ? '#f87171' : '#e5e5e5';
        resultEl.textContent = info.text;
        resultEl.className = 'run-result visible';
      } catch (e) {
        resultEl.style.borderLeft = '3px solid #dc2626';
        resultEl.style.color = '#f87171';
        resultEl.textContent = 'Request failed: ' + e.message;
        resultEl.className = 'run-result visible';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Add Source Comment';
      }
    }

    loadPosts();
  </script>
</body>
</html>`;
}
