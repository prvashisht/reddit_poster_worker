import { RedditPostContent } from './lib/types';
import { getLatestSpeakOut } from './speakout';
import { ocrEnsemble } from './ai';
import { authenticateWithReddit, getFirstPostTitle, postOnReddit } from './reddit';

export async function runJob(env: Env) {
  const { title, imageUrl } = await getLatestSpeakOut();

  const oneLiner = await ocrEnsemble(env, imageUrl, 1);
  console.log('One-liner summary:', oneLiner);
  return 'test';

  const token = await authenticateWithReddit(env);
  const firstPostTitle = await getFirstPostTitle(token, 'DHSavagery');
  if (firstPostTitle.includes(title)) {
    const msg = `Latest speakout posted already: ${title}`;
    console.error(msg);
    return { status: 'skip', message: msg };
  }

  const postContent: RedditPostContent = { title: `DH Speakout | ${title}`, url: imageUrl };
  const postResult = await postOnReddit(token, 'DHSavagery', postContent);

  return { status: 'ok', postResult };
}
