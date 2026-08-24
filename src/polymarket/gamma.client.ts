import type { GammaEvent } from "./types.js";

const GAMMA_API_URL = "https://gamma-api.polymarket.com";

export class GammaClient {
	async getBtc5mEvents(): Promise<GammaEvent[]> {
		const url = new URL(`${GAMMA_API_URL}/events`);

		url.searchParams.set("series_slug", "btc-up-or-down-5m");
		url.searchParams.set("closed", "false");
		url.searchParams.set("limit", "500");
		url.searchParams.set("order", "endDate");
		url.searchParams.set("ascending", "true");

		const response = await fetch(url);

		if (!response.ok) {
			throw new Error(
				`Gamma API request failed: ${response.status} ${response.statusText}`,
			);
		}

		return response.json() as Promise<GammaEvent[]>;
	}
}
