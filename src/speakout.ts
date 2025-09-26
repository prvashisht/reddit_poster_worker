import { SpeakOutMeta } from './lib/types';
import { SPEAKOUT_LIST_URL } from './lib/config';

export async function getLatestSpeakOut(): Promise<SpeakOutMeta> {
  const listResp = await fetch(SPEAKOUT_LIST_URL, { cf: { cacheTtl: 300 } });
  if (!listResp.ok) throw new Error(`Failed list fetch ${SPEAKOUT_LIST_URL}: ${listResp.status}`);
  const listHtml = await listResp.text();

  const m = listHtml.match(/href="(\/opinion\/speak-out\/[^"]+)"/i);
  if (!m) throw new Error('Could not find latest Speak Out link on tag page');
  const pageUrl = new URL(m[1], 'https://www.deccanherald.com').toString();

  let title = '';
  let imageUrl = '';

  const articleResp = await fetch(pageUrl, { cf: { cacheTtl: 300 } });
  if (!articleResp.ok) throw new Error(`Failed article fetch ${pageUrl}: ${articleResp.status}`);

  await new HTMLRewriter()
    .on('meta[property="og:title"]', {
      element(e) {
        const t = e.getAttribute('content');
        if (t) title = t.trim();
      },
    })
    .on('meta[property="og:image"]', {
      element(e) {
        const u = e.getAttribute('content');
        if (u) imageUrl = u.trim().split('?')[0];
      },
    })
    .on('h1', {
      text(t) {
        if (!title) title += t.text;
      },
    })
    .transform(articleResp).arrayBuffer();

  title = title.trim().split('|').pop()?.trim() ?? title;
  title = new Date(title).toLocaleDateString('en-us', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  if (!title) throw new Error('Could not extract title from article page');
  if (!imageUrl) throw new Error('Could not extract og:image from article page');

  return { title, imageUrl, pageUrl };
}
