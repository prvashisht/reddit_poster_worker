import { runBot } from '../core/run';

export async function handleScheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
  await runBot(env, { source: 'scheduled' });
}
