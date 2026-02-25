import { getLatestSpeakOut } from '../services/deccan-herald';
import {
  authenticateWithReddit,
  getFirstPostTitle,
  getRecentPosts,
  getPostComments,
  uploadImageToReddit,
  submitImagePost,
  postOnReddit,
  commentOnPost,
  type RedditPostContent,
} from '../services/reddit';
import { putRunState, type RunState, type CommentResult } from '../store/run-state';

const SUBREDDIT = 'DHSavagery';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type RunOptions = {
  skipLatestCheck?: boolean;
  dryRun?: boolean;
  source?: 'scheduled' | 'manual';
};

export async function runBot(env: Env, options: RunOptions = {}): Promise<RunState> {
  const dryRun = options.dryRun ?? (env.DRY_RUN === 'true' || env.DRY_RUN === '1');
  const skipLatestCheck =
    options.skipLatestCheck ?? (env.SKIP_LATEST_CHECK === 'true' || env.SKIP_LATEST_CHECK === '1');
  const source = options.source ?? 'scheduled';

  const save = async (state: RunState): Promise<RunState> => {
    try {
      await putRunState(env.REDDIT_POSTER_STATE, state);
    } catch (e) {
      console.error('Failed to write run state to KV', e);
    }
    return state;
  };

  const tryComment = async (
    token: string,
    postName: string | undefined,
    sourceUrl: string,
  ): Promise<CommentResult> => {
    if (!postName) return 'skipped';
    try {
      await commentOnPost(token, postName, `**Source:** ${sourceUrl}`);
      console.log('Source comment posted on', postName);
      return 'posted';
    } catch (e) {
      console.error('Failed to post source comment (non-fatal)', e);
      return 'failed';
    }
  };

  try {
    const { title, imageUrl, pageUrl } = await getLatestSpeakOut();
    const token = await authenticateWithReddit(env);

    if (!skipLatestCheck) {
      const firstPostTitle = await getFirstPostTitle(token, SUBREDDIT);
      if (firstPostTitle.includes(title)) {
        console.log(`Latest speakout posted already: ${title}`);
        return save({ lastRunAt: new Date().toISOString(), lastRunResult: 'skipped', lastPostedTitle: title, source });
      }
    } else {
      console.log('[SKIP_LATEST_CHECK] Skipping already-posted check');
    }

    const postTitle = `DH Speakout | ${title}`;

    if (dryRun) {
      console.log('[DRY_RUN] Would post:', postTitle);
      return save({ lastRunAt: new Date().toISOString(), lastRunResult: 'dry_run', lastPostedTitle: title, source });
    }

    let imageSubmitSucceeded = false;
    try {
      const { imageUrlForSubmit } = await uploadImageToReddit(token, imageUrl);
      if (!imageUrlForSubmit) throw new Error('Image upload did not return a usable URL');

      console.log('Uploaded image to Reddit:', imageUrlForSubmit);
      const result = await submitImagePost(token, SUBREDDIT, postTitle, imageUrlForSubmit);
      imageSubmitSucceeded = true;
      console.log('Submitted image post:', result);

      await sleep(3000);
      const newestPosts = await getRecentPosts(token, SUBREDDIT, 1);
      const newestPost = newestPosts[0];
      if (!newestPost?.title.includes(title)) {
        throw new Error(
          `Image post verification failed: newest post is "${newestPost?.title}", expected to contain "${title}"`,
        );
      }
      console.log('Image post verified in /new:', newestPost.name);

      // Reddit image submissions return the post name via WebSocket, not HTTP response.
      // We use the verified /new post to get the name for commenting.
      const postName = result.name ?? newestPost.name;
      const postUrl = result.url ?? newestPost.url ?? newestPost.permalink;
      const commentResult = await tryComment(token, postName, pageUrl);
      return save({
        lastRunAt: new Date().toISOString(),
        lastRunResult: 'posted',
        lastPostedTitle: postTitle,
        lastPostedUrl: postUrl,
        commentResult,
        source,
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

        const commentResult = await tryComment(token, result.name, pageUrl);
        return save({
          lastRunAt: new Date().toISOString(),
          lastRunResult: 'posted',
          lastPostedTitle: postTitle,
          lastPostedUrl: result.url,
          commentResult,
          source,
        });
      } else {
        console.error(
          'Image post was submitted but verification failed; not posting link to avoid duplicate',
          uploadErr,
        );
        return save({
          lastRunAt: new Date().toISOString(),
          lastRunResult: 'posted',
          lastPostedTitle: postTitle,
          lastError: uploadErr instanceof Error ? uploadErr.message : String(uploadErr),
          source,
        });
      }
    }
  } catch (error) {
    console.error('Bot run failed', error);
    return save({
      lastRunAt: new Date().toISOString(),
      lastRunResult: 'failed',
      lastError: error instanceof Error ? error.message : String(error),
      source,
    });
  }
}

export type EnsureCommentResult =
  | { status: 'commented' }
  | { status: 'already_exists' }
  | { status: 'title_mismatch'; latestPostTitle: string; speakoutTitle: string }
  | { status: 'failed'; error: string };

export async function ensureCommentOnLatestPost(env: Env): Promise<EnsureCommentResult> {
  const saveEntry = async (result: RunState) => {
    try {
      await putRunState(env.REDDIT_POSTER_STATE, result);
    } catch (e) {
      console.error('Failed to write comment run state to KV', e);
    }
  };

  try {
    const { title, pageUrl } = await getLatestSpeakOut();
    const token = await authenticateWithReddit(env);

    const posts = await getRecentPosts(token, SUBREDDIT, 1);
    const latestPost = posts[0];
    if (!latestPost) {
      return { status: 'failed', error: 'No posts found in subreddit' };
    }

    if (!latestPost.title.includes(title)) {
      return { status: 'title_mismatch', latestPostTitle: latestPost.title, speakoutTitle: title };
    }

    const postId = latestPost.name.replace(/^t3_/, '');
    const comments = await getPostComments(token, SUBREDDIT, postId);
    const alreadyCommented = comments.some((c) => c.author === env.REDDIT_USERNAME);

    if (alreadyCommented) {
      console.log('Bot already commented on', latestPost.name);
      await saveEntry({
        lastRunAt: new Date().toISOString(),
        lastRunResult: 'comment_skipped',
        lastPostedTitle: latestPost.title,
        lastPostedUrl: latestPost.permalink,
        source: 'manual',
      });
      return { status: 'already_exists' };
    }

    await commentOnPost(token, latestPost.name, `**Source:** ${pageUrl}`);
    console.log('Source comment posted on', latestPost.name);
    await saveEntry({
      lastRunAt: new Date().toISOString(),
      lastRunResult: 'comment_added',
      lastPostedTitle: latestPost.title,
      lastPostedUrl: latestPost.permalink,
      source: 'manual',
    });
    return { status: 'commented' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('ensureCommentOnLatestPost failed:', message);
    return { status: 'failed', error: message };
  }
}
