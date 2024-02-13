export interface Env {
	REDDIT_APP_ID: string;
	REDDIT_APP_SECRET: string;
	REDDIT_USERNAME: string;
	REDDIT_PASSWORD: string;
}

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
		requiredField: 'data-src',
		value: '',
	},
	ahref: {
		selector: '.listing-story-card:first-of-type div:nth-of-type(2) a:first-of-type',
		requiredField: 'href',
		value: '',
	},
	comment: {
		selector: '#text-element-with-ad > div > div p',
		requiredField: 'text',
		value: '',
	},
};
export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext
	): Promise<Response> {
		try {
			Object.keys(postData).forEach((key) => {
				postData[key].value = '';
			});
			await scrapeWebsite('https://www.deccanherald.com/opinion/speak-out', 'latestdate');

			let redditToken1: string = await authenticateWithReddit(env);
			const firstPostTitle = await getFirstPostTitle(redditToken1, 'DHSavagery');
			if (firstPostTitle.includes(postData.latestdate.value)) {
				// return new Response('Latest speakout posted already on ' + postData.latestdate.value);
			}

			await scrapeWebsite('https://www.deccanherald.com/opinion/speak-out', 'imgsrc');
			await scrapeWebsite('https://www.deccanherald.com/opinion/speak-out', 'ahref');
			await scrapeWebsite(postData.ahref.value, 'comment');
			const subredditName: string = 'DHSavagery';
			const postContent: RedditPostContent = {
					title: `DH Speakout | ${postData.latestdate.value}`,
					url: postData.imgsrc.value,
			};
			const postResult = await postOnReddit(redditToken1, subredditName, postContent);

			return new Response(JSON.stringify(postResult));
		} catch (error) {
				return new Response((error as Error).message, { status: 500 });
		}
	},
};

const scrapeWebsite = async (url: string, postDataKey: string): Promise<void> => {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
	}

	// Use https://www.npmjs.com/package/node-html-parser
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
				Array.from(element.attributes).filter((attr) => attr[0] === 'data-src').find((attr) => {
					postData[postDataKey].value = attr[1].split('?')[0];
				});
			} else if (postDataKey === 'ahref') {
				Array.from(element.attributes).filter((attr) => attr[0] === 'href').find((attr) => {
					postData[postDataKey].value = "https://www.deccanherald.com" + attr[1];
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
	}).toString();

	const response = await fetch(postUrl, {
			method: 'POST',
			headers: {
					'Authorization': `Bearer ${token}`,
					'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
					'User-Agent': 'web:com.pratyushvashisht.reddit-savage-bot (by /u/prvashisht)',
			},
			body: postBody,
	});

	if (!response.ok) {
			throw new Error(`Failed to post on Reddit: ${response.statusText}`);
	}

	const data = await response.json();
	return data;
}
