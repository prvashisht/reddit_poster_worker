import { getRunHistory } from '../store/run-state';
import { buildDashboardHtml } from '../dashboard/page';

export async function handleDashboard(env: Env): Promise<Response> {
  const history = await getRunHistory(env.REDDIT_POSTER_STATE);
  const html = buildDashboardHtml(history);
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
