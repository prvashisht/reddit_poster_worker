# Reddit Savage Bot worker

A Cloudflare Worker that scrapes Deccan Herald’s “Speak Out” and posts the latest image to [r/DHSavagery](https://old.reddit.com/r/DHSavagery/).

## Features

- Fetch latest article date and image URL
- Authenticate with Reddit via OAuth
- Post link to a subreddit on a CRON schedule

## Setup

1. **Clone** this repo  
2. **Create** a `.dev.vars` and fill in your Reddit app credentials:
    - `REDDIT_APP_ID`
    - `REDDIT_APP_SECRET`
    - `REDDIT_USERNAME`
    - `REDDIT_PASSWORD`
3. **Install** dependencies  
    ```bash
      npm install
    ```
4. Run tests
    ```bash
      npm test
    ```

## Local Development

To simulate the scheduled trigger locally:
  ```bash
    npx wrangler dev src/index.ts --test-scheduled
    # or via curl:
    curl "http://localhost:8787/__scheduled"
    # or 
    curl "http://localhost:8787/cdn-cgi/handler/scheduled"
  ```

To hit the HTTP stub:
  ```bash
    curl http://localhost:8787
    # returns "OK"
  ```

## Contributions

Please create a PR with your changes and describe what you intend to change with it and why.
