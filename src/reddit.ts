import { RedditPostContent, RedditTokenResponse } from './lib/types';
import { USER_AGENT } from './lib/config';

export async function authenticateWithReddit(env: Env): Promise<string> {
  const response = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${env.REDDIT_APP_ID}:${env.REDDIT_APP_SECRET}`)}`,
      'User-Agent': USER_AGENT,
    },
    body: `grant_type=password&username=${env.REDDIT_USERNAME}&password=${env.REDDIT_PASSWORD}`,
  });
  const data = await response.json() as RedditTokenResponse;
  return data.access_token;
}

export async function getFirstPostTitle(token: string, subreddit: string): Promise<string> {
  const response = await fetch(`https://oauth.reddit.com/r/${subreddit}/new`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'User-Agent': USER_AGENT,
    },
  });
  if (!response.ok) throw new Error(`Failed to fetch subreddit posts: ${response.statusText}`);
  const data: any = await response.json();
  return data.data.children[0]?.data.title || '';
}

export async function postOnReddit(token: string, subreddit: string, content: RedditPostContent): Promise<any> {
  const postBody = new URLSearchParams({
    sr: subreddit,
    title: content.title,
    url: content.url,
    kind: 'link',
    resubmit: 'true',
    api_type: 'json',
  }).toString();

  const response = await fetch('https://oauth.reddit.com/api/submit', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body: postBody,
  });

  if (!response.ok) throw new Error(`Failed to post on Reddit: ${response.statusText}`);
  const data: any = await response.json();
  return data.json.data;
}
