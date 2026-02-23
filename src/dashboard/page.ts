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
  const resultInfo = state ? RESULT_LABELS[state.lastRunResult] ?? { label: state.lastRunResult, color: '#737373' } : null;

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
    body{font-family:system-ui,-apple-system,sans-serif;background:#0f0f0f;color:#e5e5e5;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1.5rem}
    .card{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:2rem;max-width:480px;width:100%;box-shadow:0 4px 24px rgba(0,0,0,.4)}
    h1{font-size:1.25rem;font-weight:600;margin-bottom:1.5rem;color:#fff}
    h1 span{color:#ff4500}
    .row{display:flex;justify-content:space-between;align-items:center;padding:.75rem 0;border-bottom:1px solid #2a2a2a}
    .row:last-child{border-bottom:none}
    .label{font-size:.85rem;color:#a3a3a3;flex-shrink:0;margin-right:1rem}
    .value{font-size:.85rem;text-align:right;word-break:break-word}
    .value a{color:#60a5fa;text-decoration:none}
    .value a:hover{text-decoration:underline}
    .badge{font-size:.75rem;font-weight:600;color:#fff;padding:.2rem .6rem;border-radius:999px}
    .error{color:#f87171}
    .empty{color:#737373;font-size:.9rem;text-align:center;padding:1rem 0}
    .footer{margin-top:1.5rem;text-align:center;font-size:.75rem;color:#525252}
    .footer a{color:#525252}
  </style>
</head>
<body>
  <div class="card">
    <h1><span>r/DHSavagery</span> Poster</h1>
    ${statusRows}
    <div class="footer"><a href="/api/status">JSON</a></div>
  </div>
</body>
</html>`;
}
