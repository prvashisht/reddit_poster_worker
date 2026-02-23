import { getRunState } from '../store/run-state';

export async function handleApiStatus(env: Env): Promise<Response> {
  const state = await getRunState(env.REDDIT_POSTER_STATE);
  return new Response(JSON.stringify(state ?? { message: 'No runs recorded yet' }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
