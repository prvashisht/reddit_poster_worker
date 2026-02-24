import { buildLoginHtml } from '../dashboard/login';

const COOKIE_NAME = 'dash_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function getSessionCookie(request: Request): string | null {
  const header = request.headers.get('Cookie') ?? '';
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === COOKIE_NAME) return rest.join('=');
  }
  return null;
}

export function buildSetCookie(secret: string): string {
  return `${COOKIE_NAME}=${secret}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${COOKIE_MAX_AGE}`;
}

export function buildClearCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
}

export function handleLoginPage(): Response {
  return new Response(buildLoginHtml(), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export async function handleLoginSubmit(request: Request, env: Env): Promise<Response> {
  const form = await request.formData();
  const submitted = form.get('secret');

  if (submitted === env.DASHBOARD_SECRET) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/',
        'Set-Cookie': buildSetCookie(env.DASHBOARD_SECRET),
      },
    });
  }

  return new Response(buildLoginHtml({ error: true }), {
    status: 401,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export function handleLogout(): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: '/',
      'Set-Cookie': buildClearCookie(),
    },
  });
}
