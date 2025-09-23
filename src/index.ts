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

			const postContent: RedditPostContent = { title: `DH Speakout | ${title}`, url: imageUrl };
      const postResult = await postOnReddit(token, 'DHSavagery', postContent);
      return { postResult };
		} catch (error) {
			console.error('Scheduled function failed', error);
			return error;
		}
	},
	async fetch(_request: Request, _env: Env, _ctx: ExecutionContext) {
		const response = await _env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
      prompt: "Just reply with the phrase: 'Hello, Worldy!'. Do not include any other text.",
    });

    console.log(JSON.stringify(response));
		return new Response(JSON.stringify(response));
  },
};

async function getLatestSpeakOut(): Promise<SpeakOutMeta> {
  const listUrl = 'https://www.deccanherald.com/tags/speak-out';

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
