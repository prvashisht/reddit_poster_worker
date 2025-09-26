import { runJob } from "./job";
import { aiTest } from './ai';

export default {
	async scheduled(_event: any, env: Env, _ctx: ExecutionContext) {
		try {
			return await runJob(env);
		} catch (error) {
			console.error('Scheduled function failed', error);
			return new Response('Scheduled error', { status: 500 });
		}
	},
	async fetch(request: Request, env: Env, _ctx: ExecutionContext) {
		try {
      const { pathname } = new URL(request.url);

      if (pathname === '/run') {
        const result = await runJob(env);
        return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } });
      }

      if (pathname === '/ai-test') {
        const result = await aiTest(env);
        return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } });
      }

      return new Response('Not found', { status: 404 });
    } catch (err) {
      console.error('Fetch handler failed', err);
      return new Response('Server error', { status: 500 });
    }
  },
};
