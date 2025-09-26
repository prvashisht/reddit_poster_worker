export type RedditTokenResponse = { access_token: string };

export type RedditPostContent = {
  title: string;
  url: string;
};

export type SpeakOutMeta = {
  title: string;
  imageUrl: string;
  pageUrl: string;
};

export type OneLinerResult = {
  quote?: string;
  snark?: string;
  summary: string;
};
