import { getRunState } from '../store/run-state';
import { authenticateWithReddit, getRecentPosts } from '../services/reddit';

export async function handleApiStatus(env: Env): Promise<Response> {
  const state = await getRunState(env.REDDIT_POSTER_STATE);
  return new Response(JSON.stringify(state ?? { message: 'No runs recorded yet' }), {
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
