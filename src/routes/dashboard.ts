import { getRunState } from '../store/run-state';
import { buildDashboardHtml } from '../dashboard/page';

export async function handleDashboard(env: Env): Promise<Response> {
  const state = await getRunState(env.REDDIT_POSTER_STATE);
  const html = buildDashboardHtml(state);
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
