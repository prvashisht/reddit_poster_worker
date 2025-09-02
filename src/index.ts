interface RedditTokenResponse {
	access_token: string;
}

interface RedditPostContent {
	title: string;
	url: string;
}
const postData: { [key: string]: { selector: string; requiredField: string; value: string } } = {
	latestdate: {
		selector: '.listing-story-card:first-of-type h1',
		requiredField: 'text',
		value: '',
	},
	imgsrc: {
		selector: '.listing-story-card:first-of-type img',
		requiredField: 'src',
		value: '',
	},
};
export default {
	async scheduled(_event: any, env: Env, _ctx: ExecutionContext) {
		try {
			const { title, imageUrl } = await getLatestSpeakOut();
			console.log('Latest Speak Out:', title, imageUrl);

			return "text complete";

			Object.keys(postData).forEach((key) => {
				postData[key].value = '';
			});
			await getSpeakOutData('https://www.deccanherald.com/tags/dh-speak-out', 'latestdate');
			let redditToken1: string = await authenticateWithReddit(env);
			const firstPostTitle = await getFirstPostTitle(redditToken1, 'DHSavagery');
			if (!postData.latestdate.value) {
				const errorMsg = 'Latest date not found on DH Speakout';
				console.error(errorMsg);
				return errorMsg;
			}
			if (firstPostTitle.includes(postData.latestdate.value)) {
				const errorMsg = 'Latest speakout posted already on ' + postData.latestdate.value;
				console.error(errorMsg);
				return errorMsg;
			}
			await getSpeakOutData('https://www.deccanherald.com/opinion/speak-out', 'imgsrc');
			if (!postData.imgsrc.value) {
				const errorMsg = 'Image source not found on DH Speakout';
				console.error(errorMsg, postData);
				return errorMsg;
			}
			const subredditName: string = 'DHSavagery';
			const postContent: RedditPostContent = {
					title: `DH Speakout | ${postData.latestdate.value}`,
					url: postData.imgsrc.value,
			};
			const postResult = await postOnReddit(redditToken1, subredditName, postContent);
			console.log('Posted on Reddit', postResult);
			return { postResult };
		} catch (error) {
			console.error('Scheduled function failed', error);
			return error;
		}
	},
	async fetch(_request: Request, _env: Env, _ctx: ExecutionContext) {
    return new Response('OK')
  },
};

type SpeakOutMeta = { title: string; imageUrl: string; pageUrl: string };

async function getLatestSpeakOut(): Promise<SpeakOutMeta> {
  const listUrl = 'https://www.deccanherald.com/tags/dh-speak-out';

  // 1) Fetch the server-rendered tag page and grab the first article URL
  const listResp = await fetch(listUrl, { cf: { cacheTtl: 300 } });
  if (!listResp.ok) throw new Error(`Failed list fetch ${listUrl}: ${listResp.status}`);
  const listHtml = await listResp.text();

  const m = listHtml.match(/href="(\/opinion\/speak-out\/[^"]+)"/i);
  if (!m) throw new Error('Could not find latest Speak Out link on tag page');
  const pageUrl = new URL(m[1], 'https://www.deccanherald.com').toString();

  // 2) Fetch the article page and extract og:title and og:image
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
    // fallback: capture the visible H1 if og:title is missing
    .on('h1', {
      text(t) {
        if (!title) title += t.text;
      },
    })
    .transform(articleResp).arrayBuffer(); // consume body to run the rewriter

  title = title.trim();
  if (!title) throw new Error('Could not extract title from article page');
  if (!imageUrl) throw new Error('Could not extract og:image from article page');

  return { title, imageUrl, pageUrl };
}

const getSpeakOutData = async (url: string, postDataKey: string): Promise<void> => {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
	}

	await new HTMLRewriter().on(postData[postDataKey].selector, {
		text(text) {
			if (postDataKey === 'latestdate') {
				postData[postDataKey].value += text.text ? 
				new Date(text.text.split(" | ")[1])
					.toLocaleDateString('en-us', {
							weekday: "long",
							year: "numeric",
							month: "long",
							day: "numeric"
					}) 
				: '';
			} else if (postDataKey === 'comment') {
				postData[postDataKey].value += text.text + "\n";
			}
		},
		element(element) {
			if (postDataKey === 'imgsrc') {
				Array.from(element.attributes).filter((attr) => attr[0] === 'src').find((attr) => {
					postData[postDataKey].value = attr[1]
						.split('?')[0]
						.split('\/\/')[1]
						.replace('media.assettype.com', 'images.deccanherald.com');
				});
			} else if (postDataKey === 'ahref') {
				Array.from(element.attributes).filter((attr) => attr[0] === 'href').find((attr) => {
					postData[postDataKey].value = "https://www.deccanherald.com" + attr[1];
				});
			} else if (postDataKey === 'readmorelink') {
				Array.from(element.attributes).filter((attr) => attr[0] === 'href').find((attr) => {
					postData[postDataKey].value = attr[1];
				});
			}
		}
	}).transform(response).text();
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
