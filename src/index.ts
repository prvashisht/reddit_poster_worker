type RedditTokenResponse = {
	access_token: string;
};

type RedditPostContent = {
	title: string;
	url: string;
}

type SpeakOutMeta = {
	title: string;
	imageUrl: string;
	pageUrl: string;
};

export default {
  async scheduled(_event: any, env: Env, _ctx: ExecutionContext) {
    try {
      const { title, imageUrl } = await getLatestSpeakOut();

      const token = await authenticateWithReddit(env);
      const firstPostTitle = await getFirstPostTitle(token, 'DHSavagery');
      if (firstPostTitle.includes(title)) {
        const msg = `Latest speakout posted already: ${title}`;
        console.error(msg);
        return msg;
      }

      const postTitle = `DH Speakout | ${title}`;
      let result: unknown;

      try {
        const { imageUrlForSubmit } = await uploadImageToReddit(token, imageUrl);
        if (!imageUrlForSubmit) {
          throw new Error('Image upload did not return a usable URL');
        }

        console.log('Uploaded image to Reddit:', imageUrlForSubmit);
        result = await submitImagePost(token, 'DHSavagery', postTitle, imageUrlForSubmit);
        console.log('Submitted image post:', result);
      } catch (uploadErr) {
        console.error('Image upload or image post failed, falling back to link post', uploadErr);

        const postContent: RedditPostContent = { title: postTitle, url: imageUrl };
        result = await postOnReddit(token, 'DHSavagery', postContent);
        console.log('Submitted fallback link post:', result);
      }
      return { result };
    } catch (error) {
      console.error('Scheduled function failed', error);
      return error;
    }
  },

  async fetch(_request: Request, _env: Env, _ctx: ExecutionContext) {
    return new Response('OK');
  },
};

type UploadResult = { assetId: string; imageUrlForSubmit: string };

async function uploadImageToReddit(token: string, sourceImageUrl: string): Promise<UploadResult> {
  const leaseRes = await fetch('https://oauth.reddit.com/api/media/asset.json?raw_json=1', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'web:com.pratyushvashisht.reddit-savage-bot (by /u/prvashisht)',
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

  const key =
    (Array.isArray(fields) ? fields.find((field: any) => field.name === 'key')?.value : fields?.key) as string | undefined;
  const s3Url = key ? `https://reddit-uploaded-media.s3-accelerate.amazonaws.com/${key}` : '';
  const previewUrl = `https://i.redd.it/${assetId}.${mime.includes('png') ? 'png' : 'jpg'}`;
  const imageUrlForSubmit = s3Url || previewUrl;

  return { assetId, imageUrlForSubmit };
}

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

async function submitImagePost(
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
      'User-Agent': 'web:com.pratyushvashisht.reddit-savage-bot (by /u/prvashisht)',
    },
    body,
  });

  const data = await resp.json<RedditSubmitResponse>();

  const errors = data.json?.errors ?? [];
  if (!resp.ok || errors.length > 0) {
    throw new Error(
      `Submit failed: ${resp.status} ${JSON.stringify(errors)}`,
    );
  }
  return data.json.data;
}

async function getLatestSpeakOut(): Promise<SpeakOutMeta> {
  const listUrl = 'https://www.deccanherald.com/tags/dh-speak-out';

  const listResp = await fetch(listUrl, { cf: { cacheTtl: 300 } });
  if (!listResp.ok) throw new Error(`Failed list fetch ${listUrl}: ${listResp.status}`);
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
							weekday: "long",
							year: "numeric",
							month: "long",
							day: "numeric"
					});
  if (!title) throw new Error('Could not extract title from article page');
  if (!imageUrl) throw new Error('Could not extract og:image from article page');

  return { title, imageUrl, pageUrl };
}

const authenticateWithReddit = async (env: Env): Promise<string> => {	
	const response = await fetch('https://www.reddit.com/api/v1/access_token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			'Authorization': `Basic ${btoa(`${env.REDDIT_APP_ID}:${env.REDDIT_APP_SECRET}`)}`,
			'User-Agent': 'web:com.pratyushvashisht.reddit-savage-bot (by /u/prvashisht)',
		},
		body: `grant_type=password&username=${env.REDDIT_USERNAME}&password=${env.REDDIT_PASSWORD}`,
	});
	const data = await response.json() as RedditTokenResponse;
	return data.access_token;
}
const getFirstPostTitle = async (token: string, subreddit: string): Promise<string> => {
	const response = await fetch(`https://oauth.reddit.com/r/${subreddit}/new`, {
			headers: {
					'Authorization': `Bearer ${token}`,
					'User-Agent': 'web:com.pratyushvashisht.reddit-savage-bot (by /u/prvashisht)',
			},
	});
	
	if (!response.ok) {
		throw new Error(`Failed to fetch subreddit posts: ${response.statusText}`);
	}

	const data: any = await response.json();
	return data.data.children[0]?.data.title || "";
}
const postOnReddit = async (token: string, subreddit: string, content: RedditPostContent): Promise<any> => {
	const postUrl = `https://oauth.reddit.com/api/submit`;

	const postBody = new URLSearchParams({
		sr: subreddit,
		title: content.title,
		url: content.url,
		kind: 'link',
		resubmit: 'true', // Allows resubmitting the same link
		api_type: 'json',
	}).toString();

	const response = await fetch(postUrl, {
			method: 'POST',
			headers: {
					'Authorization': `Bearer ${token}`,
					'Content-Type': 'application/x-www-form-urlencoded',
					'User-Agent': 'web:com.pratyushvashisht.reddit-savage-bot (by /u/prvashisht)',
			},
			body: postBody,
	});

	if (!response.ok) {
			throw new Error(`Failed to post on Reddit: ${response.statusText}`);
	}

	const data: any = await response.json();
	return data.json.data;
}
