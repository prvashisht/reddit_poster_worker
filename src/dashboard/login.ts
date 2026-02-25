export function buildLoginHtml(opts: { error?: boolean } = {}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sign in · Reddit Savage Bot Dashboard</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,-apple-system,sans-serif;background:#0f0f0f;color:#e5e5e5;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1.5rem}
    .card{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:2rem;max-width:360px;width:100%;box-shadow:0 4px 24px rgba(0,0,0,.4)}
    .logo{font-size:1.25rem;font-weight:600;color:#fff;margin-bottom:.5rem}
    .logo span{color:#ff4500}
    .subtitle{font-size:.85rem;color:#737373;margin-bottom:1.75rem}
    label{display:block;font-size:.8rem;color:#a3a3a3;margin-bottom:.4rem}
    input[type=password]{width:100%;background:#111;border:1px solid #2a2a2a;border-radius:8px;padding:.6rem .75rem;color:#e5e5e5;font-size:.9rem;outline:none;transition:border-color .15s}
    input[type=password]:focus{border-color:#ff4500}
    .error{font-size:.8rem;color:#f87171;margin-top:.6rem;min-height:1.2em}
    button{margin-top:1.25rem;width:100%;background:#ff4500;border:none;border-radius:8px;padding:.65rem;color:#fff;font-size:.9rem;font-weight:600;cursor:pointer;transition:background .15s}
    button:hover{background:#e03d00}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo"><span>r/DHSavagery</span> Poster</div>
    <div class="subtitle">Enter your access code to continue</div>
    <form method="POST" action="/login">
      <label for="secret">Access code</label>
      <input id="secret" name="secret" type="password" placeholder="••••••••" autofocus autocomplete="current-password">
      <div class="error">${opts.error ? 'Incorrect access code. Please try again.' : ''}</div>
      <button type="submit">Sign in</button>
    </form>
  </div>
</body>
</html>`;
}
