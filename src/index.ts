import { ClobClient } from "./polymarket/clob.client.js";
import { MarketManager } from "./polymarket/market.manager.js";
import { GammaClient } from "./polymarket/gamma.client.js";
import { upsertMarket } from "./db/repositories/markets.js";
import { Snapshotter } from "./recorder/snapshotter.js";
import app from "./app.js";
import { listen } from "node:quic";

const RETRY_DELAY_MS = 1_000;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

async function main(): Promise<void> {
	const gammaClient = new GammaClient();
	const marketManager = new MarketManager(gammaClient);

	while (true) {
		let market: Awaited<ReturnType<MarketManager["getCurrentBtcMarket"]>>;

		try {
			market = await marketManager.getCurrentBtcMarket();
		} catch (error) {
			console.error("Failed to fetch current market:", error);
			await sleep(RETRY_DELAY_MS);
			continue;
		}

		if (!market) {
			console.log("No active BTC 5-minute market found.");
			await sleep(RETRY_DELAY_MS);
			continue;
		}

		const savedMarket = await upsertMarket({
			conditionId: market.market.conditionId,
			slug: market.event.slug,
			question: market.market.question,

			startTime: market.startTime,
			endTime: market.endTime,

			upTokenId: market.upTokenId,
			downTokenId: market.downTokenId,
		});

		console.log("\nCurrent BTC 5-minute market");
		console.log("────────────────────────────────────");

		console.log("Database ID:", savedMarket.id);
		console.log("Event ID:", market.event.id);
		console.log("Event:", market.event.title);
		console.log("Slug:", market.event.slug);

		console.log("\nMarket ID:", market.market.id);
		console.log("Question:", market.market.question);
		console.log("Condition ID:", market.market.conditionId);

		console.log("\nActual market timing:");
		console.log("Start:", market.startTime.toISOString());
		console.log("End:", market.endTime.toISOString());

		console.log("\nUP token:", market.upTokenId);
		console.log("DOWN token:", market.downTokenId);

		const clobClient = new ClobClient({
			upTokenId: market.upTokenId,
			downTokenId: market.downTokenId,
		});

		const snapshotter = new Snapshotter({
			marketId: savedMarket.id,
			startTime: market.startTime,
			endTime: market.endTime,
			getState: () => clobClient.getState(),
		});

		try {
			clobClient.connect();

			await snapshotter.start();

			console.log(
				`Finished market ${savedMarket.id}. Looking for next market...`,
			);
		} catch (error) {
			console.error(`Market ${savedMarket.id} recorder failed:`, error);
		} finally {
			snapshotter.stop();
			clobClient.close();
		}

		/*
		 * The current market may still be returned by Gamma for a
		 * very short period around the boundary. Wait until the next
		 * market becomes active before starting another session.
		 */
		while (true) {
			const nowMs = Date.now();
			const endMs = market.endTime.getTime();

			if (nowMs <= endMs) {
				await sleep(endMs - nowMs + 100);
				continue;
			}

			const nextMarket = await marketManager.getCurrentBtcMarket();

			if (
				nextMarket &&
				nextMarket.market.conditionId !== market.market.conditionId
			) {
				break;
			}

			await sleep(RETRY_DELAY_MS);
		}
	}
}

main().catch((error) => {
	console.error("Failed to start:", error);
	process.exit(1);
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
	console.log(`🚀 Server running on http://localhost:${PORT}`);
});
