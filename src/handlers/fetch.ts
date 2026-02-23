import { handleDashboard } from '../routes/dashboard';
import { handleApiStatus } from '../routes/api';

export async function handleFetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
  const { pathname } = new URL(request.url);

  if (pathname === '/' || pathname === '/dashboard') {
    return handleDashboard(env);
  }

  if (pathname === '/api/status') {
    return handleApiStatus(env);
  }

  return new Response('Not Found', { status: 404 });
}
