import { getLatestSpeakOut } from '../services/deccan-herald';
import {
  authenticateWithReddit,
  getFirstPostTitle,
  uploadImageToReddit,
  submitImagePost,
  postOnReddit,
  commentOnPost,
  type RedditPostContent,
} from '../services/reddit';
import { putRunState, type RunState } from '../store/run-state';

const SUBREDDIT = 'DHSavagery';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function handleScheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
  const dryRun = env.DRY_RUN === 'true' || env.DRY_RUN === '1';
  const skipLatestCheck = env.SKIP_LATEST_CHECK === 'true' || env.SKIP_LATEST_CHECK === '1';

  const writeState = async (state: RunState) => {
    try {
      await putRunState(env.REDDIT_POSTER_STATE, state);
    } catch (e) {
      console.error('Failed to write run state to KV', e);
    }
  };

  const tryComment = async (token: string, postName: string | undefined, sourceUrl: string) => {
    if (!postName) return;
    try {
      await commentOnPost(token, postName, `**Source:** ${sourceUrl}`);
      console.log('Source comment posted on', postName);
    } catch (e) {
      console.error('Failed to post source comment (non-fatal)', e);
    }
  };

  try {
    const { title, imageUrl, pageUrl } = await getLatestSpeakOut();

    const token = await authenticateWithReddit(env);

    if (!skipLatestCheck) {
      const firstPostTitle = await getFirstPostTitle(token, SUBREDDIT);
      if (firstPostTitle.includes(title)) {
        console.log(`Latest speakout posted already: ${title}`);
        await writeState({
          lastRunAt: new Date().toISOString(),
          lastRunResult: 'skipped',
          lastPostedTitle: title,
        });
        return;
      }
    } else {
      console.log('[SKIP_LATEST_CHECK] Skipping already-posted check');
    }

    const postTitle = `DH Speakout | ${title}`;

    if (dryRun) {
      console.log('[DRY_RUN] Would post:', postTitle);
      await writeState({
        lastRunAt: new Date().toISOString(),
        lastRunResult: 'dry_run',
        lastPostedTitle: title,
      });
      return;
    }

    let imageSubmitSucceeded = false;
    try {
      const { imageUrlForSubmit } = await uploadImageToReddit(token, imageUrl);
      if (!imageUrlForSubmit) {
        throw new Error('Image upload did not return a usable URL');
      }

      console.log('Uploaded image to Reddit:', imageUrlForSubmit);
      const result = await submitImagePost(token, SUBREDDIT, postTitle, imageUrlForSubmit);
      imageSubmitSucceeded = true;
      console.log('Submitted image post:', result);

      await sleep(3000);
      const newestTitle = await getFirstPostTitle(token, SUBREDDIT);
      if (!newestTitle.includes(title)) {
        throw new Error(
          `Image post verification failed: newest post is "${newestTitle}", expected to contain "${title}"`,
        );
      }
      console.log('Image post verified in /new');
      await tryComment(token, result.name, pageUrl);

      await writeState({
        lastRunAt: new Date().toISOString(),
        lastRunResult: 'posted',
        lastPostedTitle: postTitle,
        lastPostedUrl: result.url,
      });
    } catch (uploadErr) {
      if (!imageSubmitSucceeded) {
        console.error('Image upload/post failed, falling back to link post', uploadErr);
        const postContent: RedditPostContent = { title: postTitle, url: imageUrl };
        const result = await postOnReddit(token, SUBREDDIT, postContent);
        console.log('Submitted fallback link post:', result);

        await sleep(3000);
        const newestTitle = await getFirstPostTitle(token, SUBREDDIT);
        if (!newestTitle.includes(title)) {
          throw new Error(
            `Link post verification also failed: newest post is "${newestTitle}", expected to contain "${title}"`,
          );
        }
        console.log('Link post verified in /new');
        await tryComment(token, result.name, pageUrl);

        await writeState({
          lastRunAt: new Date().toISOString(),
          lastRunResult: 'posted',
          lastPostedTitle: postTitle,
          lastPostedUrl: result.url,
        });
      } else {
        console.error(
          'Image post was submitted but verification failed; not posting link to avoid duplicate',
          uploadErr,
        );
        await writeState({
          lastRunAt: new Date().toISOString(),
          lastRunResult: 'posted',
          lastPostedTitle: postTitle,
          lastError: uploadErr instanceof Error ? uploadErr.message : String(uploadErr),
        });
      }
    }
  } catch (error) {
    console.error('Scheduled function failed', error);
    await writeState({
      lastRunAt: new Date().toISOString(),
      lastRunResult: 'failed',
      lastError: error instanceof Error ? error.message : String(error),
    });
  }
}
