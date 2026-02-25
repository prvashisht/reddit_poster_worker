import { getRunState, getRunHistory } from '../store/run-state';
import { authenticateWithReddit, getRecentPosts } from '../services/reddit';
import { runBot, ensureCommentOnLatestPost } from '../core/run';

export async function handleApiStatus(env: Env): Promise<Response> {
  const state = await getRunState(env.REDDIT_POSTER_STATE);
  return new Response(JSON.stringify(state ?? { message: 'No runs recorded yet' }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export async function handleApiHistory(env: Env): Promise<Response> {
  const history = await getRunHistory(env.REDDIT_POSTER_STATE);
  return new Response(JSON.stringify(history), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export async function handleApiPosts(env: Env): Promise<Response> {
  const token = await authenticateWithReddit(env);
  const posts = await getRecentPosts(token, 'DHSavagery');
  return new Response(JSON.stringify(posts), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export async function handleApiComment(env: Env): Promise<Response> {
  const result = await ensureCommentOnLatestPost(env);
  const ok = result.status === 'commented' || result.status === 'already_exists';
  return new Response(JSON.stringify(result), {
    status: ok ? 200 : 422,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export async function handleApiRun(request: Request, env: Env): Promise<Response> {
  let body: { dryRun?: boolean; skipLatestCheck?: boolean } = {};
  try {
    if (request.headers.get('content-type')?.includes('application/json')) {
      body = await request.json();
    }
  } catch {
    // no body or invalid JSON — use defaults
  }

  const state = await runBot(env, {
    source: 'manual',
    // Default false for manual runs — don't inherit env vars meant for dev/testing
    dryRun: body.dryRun ?? false,
    skipLatestCheck: body.skipLatestCheck ?? false,
  });

  return new Response(JSON.stringify(state), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
