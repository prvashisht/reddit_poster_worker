export type RunResult = 'posted' | 'skipped' | 'failed' | 'dry_run';

export type RunState = {
  lastRunAt: string;
  lastRunResult: RunResult;
  lastPostedTitle?: string;
  lastPostedUrl?: string;
  lastError?: string;
};

const STATE_KEY = 'run_state';

export async function getRunState(kv: KVNamespace): Promise<RunState | null> {
  return kv.get<RunState>(STATE_KEY, 'json');
}

export async function putRunState(kv: KVNamespace, state: RunState): Promise<void> {
  await kv.put(STATE_KEY, JSON.stringify(state));
}
