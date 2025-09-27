import { OneLinerResult } from './lib/types';
import {
  VISION_MODEL,
  TEST_MODEL,
  TEST_PROMPT,
  SYSTEM_PROMPT,
  USER_PROMPT,
  JUDGE_SYSTEM_PROMPT,
  JUDGE_USER_PROMPT_TEMPLATE,
} from './lib/config';

async function fetchAsDataUrl(imageUrl: string): Promise<string> {
  const resp = await fetch(imageUrl, { cf: { cacheTtl: 300 } });
  if (!resp.ok) throw new Error(`Image fetch failed ${resp.status}`);
  const mime = resp.headers.get('content-type') || 'image/jpeg';
  const buf = await resp.arrayBuffer();
  const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
  return `data:${mime};base64,${b64}`;
}

export async function ocrAndSummarize(env: Env, imageHttpUrl: string): Promise<OneLinerResult> {
  const dataUrl = await fetchAsDataUrl(imageHttpUrl);

  const res: any = await env.AI.run(VISION_MODEL, {
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: USER_PROMPT },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
    max_tokens: 160,
    temperature: 0.5,
  });

  const text = typeof res === 'string' ? res : (res.response ?? JSON.stringify(res));

  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed.summary === 'string') return parsed as OneLinerResult;
  } catch {
    console.warn('AI output not JSON, using fallback:', text);
  }
  return { summary: String(text).split('\n').join(' ').slice(0, 180) };
}

export async function multiOcrAndSummarize(
  env: Env,
  imageHttpUrl: string,
  runs: number = 3
): Promise<OneLinerResult[]> {
  const results: OneLinerResult[] = [];
  for (let i = 0; i < runs; i++) {
    const result = await ocrAndSummarize(env, imageHttpUrl);
    console.log(`OCR run ${i + 1}:`, result);
    results.push(result);
  }
  return results;
}

export async function chooseBestSummary(
  env: Env,
  imageHttpUrl: string,
  candidates: OneLinerResult[]
): Promise<OneLinerResult> {
  console.log(`Judging ${candidates.length} candidates`);
  if (candidates.length === 0) throw new Error('No candidates to judge');
  if (candidates.length === 1) return candidates[0];

  const dataUrl = await fetchAsDataUrl(imageHttpUrl);
  const candidateText = candidates.map((c, i) => `${i + 1}. ${c.summary}`).join('\n');
  const judgePrompt = JUDGE_USER_PROMPT_TEMPLATE.replace('{{CANDIDATES}}', candidateText);

  const res: any = await env.AI.run(VISION_MODEL, {
    messages: [
      { role: 'system', content: JUDGE_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: judgePrompt },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
    max_tokens: 160,
    temperature: 0,
  });

  console.log('Judge response:', res);
  const text = typeof res === 'string' ? res : (res.response ?? JSON.stringify(res));
  try {
    const parsed = JSON.parse(text);
    const idx =
      Math.max(1, Math.min(candidates.length, Number(parsed.bestIndex))) - 1;
    const picked = candidates[idx] ?? candidates[0];
    const summary =
      typeof parsed.summary === 'string' && parsed.summary.trim()
        ? parsed.summary
        : picked.summary;
    return { summary };
  } catch {
    console.warn('Judge output not JSON, falling back to first candidate:', text);
    return candidates[0];
  }
}

export async function ocrEnsemble(
  env: Env,
  imageHttpUrl: string,
  runs: number = 3
): Promise<OneLinerResult> {
  if (runs <= 1) return ocrAndSummarize(env, imageHttpUrl);
  const candidates = await multiOcrAndSummarize(env, imageHttpUrl, runs);
  if (candidates.length <= 1) return candidates[0];
  return chooseBestSummary(env, imageHttpUrl, candidates);
}

export async function aiTest(env: Env) {
  return env.AI.run(TEST_MODEL, { prompt: TEST_PROMPT });
}
