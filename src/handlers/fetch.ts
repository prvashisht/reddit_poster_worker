import { handleDashboard } from '../routes/dashboard';
import { handleApiStatus, handleApiPosts } from '../routes/api';

function isAuthorized(request: Request, env: Env): boolean {
  const secret = env.DASHBOARD_SECRET;
  if (!secret) return true;

  const url = new URL(request.url);
  if (url.searchParams.get('secret') === secret) return true;

  const authHeader = request.headers.get('Authorization');
  if (authHeader === `Bearer ${secret}`) return true;

  return false;
}

export async function handleFetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
  const { pathname } = new URL(request.url);

  if (pathname === '/' || pathname === '/dashboard') {
    if (!isAuthorized(request, env)) return new Response('Unauthorized', { status: 401 });
    return handleDashboard(env);
  }

  if (pathname === '/api/status') {
    if (!isAuthorized(request, env)) return new Response('Unauthorized', { status: 401 });
    return handleApiStatus(env);
  }

  if (pathname === '/api/posts') {
    if (!isAuthorized(request, env)) return new Response('Unauthorized', { status: 401 });
    return handleApiPosts(env);
  }

  return new Response('Not Found', { status: 404 });
}
