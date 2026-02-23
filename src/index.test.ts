import { unstable_dev } from "wrangler";
import type { Unstable_DevWorker } from "wrangler";
import { describe, expect, it, beforeAll, afterAll } from "vitest";

describe("Worker", () => {
	let worker: Unstable_DevWorker;

	beforeAll(async () => {
		worker = await unstable_dev("src/index.ts", {
			experimental: { disableExperimentalWarning: true },
		});
	});

	afterAll(async () => {
		await worker.stop();
	});

	it("GET / returns dashboard HTML", async () => {
		const resp = await worker.fetch("/");
		expect(resp.status).toBe(200);
		expect(resp.headers.get("content-type")).toContain("text/html");
		const text = await resp.text();
		expect(text).toContain("r/DHSavagery");
		expect(text).toContain("No runs recorded yet");
	});

	it("GET /api/status returns JSON", async () => {
		const resp = await worker.fetch("/api/status");
		expect(resp.status).toBe(200);
		expect(resp.headers.get("content-type")).toContain("application/json");
		const body = await resp.json();
		expect(body).toHaveProperty("message", "No runs recorded yet");
	});

	it("GET /unknown returns 404", async () => {
		const resp = await worker.fetch("/unknown");
		expect(resp.status).toBe(404);
	});
});
