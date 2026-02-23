const USER_AGENT = 'web:com.pratyushvashisht.reddit-savage-bot (by /u/prvashisht)';

type RedditTokenResponse = {
  access_token: string;
};

export type RedditPostContent = {
  title: string;
  url: string;
};

type UploadResult = { assetId: string; imageUrlForSubmit: string };

type RedditSubmitError = [string, string?, unknown?];

type RedditSubmitData = {
  id?: string;
  name?: string;
  url?: string;
  websocket_url?: string;
  user_submitted_page?: string;
};

type RedditSubmitResponse = {
  json: {
    errors: RedditSubmitError[];
    data: RedditSubmitData;
  };
};

export async function authenticateWithReddit(env: Env): Promise<string> {
  const response = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${env.REDDIT_APP_ID}:${env.REDDIT_APP_SECRET}`)}`,
      'User-Agent': USER_AGENT,
    },
    body: `grant_type=password&username=${env.REDDIT_USERNAME}&password=${env.REDDIT_PASSWORD}`,
  });
  const data = (await response.json()) as RedditTokenResponse;
  return data.access_token;
}

export async function getFirstPostTitle(token: string, subreddit: string): Promise<string> {
  const response = await fetch(`https://oauth.reddit.com/r/${subreddit}/new`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch subreddit posts: ${response.statusText}`);
  }

  const data: any = await response.json();
  return data.data.children[0]?.data.title || '';
}

export async function uploadImageToReddit(token: string, sourceImageUrl: string): Promise<UploadResult> {
  const leaseRes = await fetch('https://oauth.reddit.com/api/media/asset.json?raw_json=1', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': USER_AGENT,
    },
    body: new URLSearchParams({ filepath: 'speakout.jpg', mimetype: 'image/jpeg' }),
  });
  if (!leaseRes.ok) throw new Error(`Lease request failed: ${leaseRes.status} ${await leaseRes.text()}`);
  const lease: any = await leaseRes.json();

  const action = String(lease?.args?.action || '');
  const actionUrl = action.startsWith('http') ? action : `https:${action}`;
  const fields = lease?.args?.fields;
  const assetId: string = String(lease?.asset?.asset_id || '');

  const form = new FormData();
  if (Array.isArray(fields)) {
    for (const { name, value } of fields) form.append(name, value);
  } else {
    for (const [k, v] of Object.entries(fields || {})) form.append(k, String(v));
  }

  const imgResp = await fetch(sourceImageUrl);
  if (!imgResp.ok) throw new Error(`Image download failed: ${imgResp.status}`);
  const mime = imgResp.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
  const bytes = await imgResp.arrayBuffer();
  form.append('file', new Blob([bytes], { type: mime }), `upload.${mime.includes('png') ? 'png' : 'jpg'}`);

  const s3Res = await fetch(actionUrl, { method: 'POST', body: form });
  if (!s3Res.ok) throw new Error(`S3 upload failed: ${s3Res.status} ${await s3Res.text()}`);

  const key = (Array.isArray(fields)
    ? fields.find((field: any) => field.name === 'key')?.value
    : fields?.key) as string | undefined;
  const s3Url = key ? `https://reddit-uploaded-media.s3-accelerate.amazonaws.com/${key}` : '';
  const previewUrl = `https://i.redd.it/${assetId}.${mime.includes('png') ? 'png' : 'jpg'}`;
  const imageUrlForSubmit = s3Url || previewUrl;

  return { assetId, imageUrlForSubmit };
}

export async function submitImagePost(
  token: string,
  subreddit: string,
  title: string,
  imageUrl: string,
): Promise<RedditSubmitData> {
  const postUrl = 'https://oauth.reddit.com/api/submit?raw_json=1';
  const body = new URLSearchParams({
    sr: subreddit,
    title,
    kind: 'image',
    url: imageUrl,
    resubmit: 'true',
    sendreplies: 'true',
    api_type: 'json',
  });

  const resp = await fetch(postUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body,
  });

  const data = await resp.json<RedditSubmitResponse>();

  const errors = data.json?.errors ?? [];
  if (!resp.ok || errors.length > 0) {
    throw new Error(`Submit failed: ${resp.status} ${JSON.stringify(errors)}`);
  }
  return data.json.data;
}

export async function postOnReddit(
  token: string,
  subreddit: string,
  content: RedditPostContent,
): Promise<any> {
  const postUrl = 'https://oauth.reddit.com/api/submit';

  const postBody = new URLSearchParams({
    sr: subreddit,
    title: content.title,
    url: content.url,
    kind: 'link',
    resubmit: 'true',
    api_type: 'json',
  }).toString();

  const response = await fetch(postUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body: postBody,
  });

  if (!response.ok) {
    throw new Error(`Failed to post on Reddit: ${response.statusText}`);
  }

  const data: any = await response.json();
  return data.json.data;
}
