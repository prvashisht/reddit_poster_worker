import { OneLinerResult } from './lib/types';
import { VISION_MODEL, TEST_MODEL, TEST_PROMPT, SYSTEM_PROMPT, USER_PROMPT } from './lib/config';

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
          { type: 'image_url', image_url: { url: dataUrl } }
        ]
      }
    ],
    max_tokens: 160,
    temperature: 0.5
  });

  const text = typeof res === 'string' ? res : (res.response ?? JSON.stringify(res));

  // If we later switch to strict JSON prompting, we can parse here.
  // For now, return a single-line summary fallback.
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed.summary === 'string') return parsed as OneLinerResult;
  } catch {
    console.warn('AI output not JSON, using fallback:', text);
  }
  return { summary: String(text).split('\n').join(' ').slice(0, 180) };
}

export async function aiTest(env: Env) {
  return env.AI.run(TEST_MODEL, { prompt: TEST_PROMPT });
}
