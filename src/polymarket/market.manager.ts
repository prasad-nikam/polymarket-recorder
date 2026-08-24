import { GammaClient } from "./gamma.client.js";
import type { GammaEvent, GammaMarket } from "./types.js";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

function getMarketStartFromSlug(slug: string): Date {
	const match = slug.match(/^btc-updown-5m-(\d+)$/);

	if (!match) {
		throw new Error(`Invalid BTC 5m market slug: ${slug}`);
	}

	const timestamp = Number(match[1]);

	if (!Number.isSafeInteger(timestamp)) {
		throw new Error(`Invalid timestamp in market slug: ${slug}`);
	}

	return new Date(timestamp * 1000);
}

function getMarketEndFromSlug(slug: string): Date {
	return new Date(getMarketStartFromSlug(slug).getTime() + FIVE_MINUTES_MS);
}

export interface BtcMarket {
	event: GammaEvent;
	market: GammaMarket;

	upTokenId: string;
	downTokenId: string;

	startTime: Date;
	endTime: Date;
}

export class MarketManager {
	constructor(private readonly gammaClient: GammaClient) {}

	async getCurrentBtcMarket(): Promise<BtcMarket | null> {
		const events = await this.gammaClient.getBtc5mEvents();

		const now = Date.now();

		for (const event of events) {
			const startTime = getMarketStartFromSlug(event.slug);
			const endTime = getMarketEndFromSlug(event.slug);

			const start = startTime.getTime();
			const end = endTime.getTime();

			if (start <= now && now < end) {
				const market = event.markets[0];

				if (!market) {
					continue;
				}

				const outcomes = JSON.parse(market.outcomes) as string[];
				const tokenIds = JSON.parse(market.clobTokenIds) as string[];

				const upIndex = outcomes.findIndex(
					(outcome) => outcome.toLowerCase() === "up",
				);

				const downIndex = outcomes.findIndex(
					(outcome) => outcome.toLowerCase() === "down",
				);

				if (upIndex === -1 || downIndex === -1) {
					throw new Error(
						`Unexpected outcomes for market ${market.id}: ${market.outcomes}`,
					);
				}

				const upTokenId = tokenIds[upIndex];
				const downTokenId = tokenIds[downIndex];

				if (!upTokenId || !downTokenId) {
					throw new Error(
						`Missing token IDs for market ${market.id}`,
					);
				}

				return {
					event,
					market,

					upTokenId,
					downTokenId,

					startTime,
					endTime,
				};
			}
		}

		return null;
	}
}
