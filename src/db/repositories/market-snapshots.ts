import { db } from "../client.js";
import { marketSnapshots } from "../schema.js";

export interface InsertMarketSnapshotInput {
	time: Date;
	marketId: number;

	elapsedSeconds: number;
	remainingSeconds: number;

	btcPrice?: number | null;

	upBid?: number | null;
	upAsk?: number | null;
	upMid?: number | null;
	upLast?: number | null;

	downBid?: number | null;
	downAsk?: number | null;
	downMid?: number | null;
	downLast?: number | null;
}

export async function insertMarketSnapshot(input: InsertMarketSnapshotInput) {
	const [snapshot] = await db
		.insert(marketSnapshots)
		.values({
			time: input.time,
			marketId: input.marketId,

			elapsedSeconds: input.elapsedSeconds,
			remainingSeconds: input.remainingSeconds,

			btcPrice: input.btcPrice?.toString() ?? null,

			upBid: input.upBid?.toString() ?? null,
			upAsk: input.upAsk?.toString() ?? null,
			upMid: input.upMid?.toString() ?? null,
			upLast: input.upLast?.toString() ?? null,

			downBid: input.downBid?.toString() ?? null,
			downAsk: input.downAsk?.toString() ?? null,
			downMid: input.downMid?.toString() ?? null,
			downLast: input.downLast?.toString() ?? null,
		})
		.returning();

	return snapshot;
}
