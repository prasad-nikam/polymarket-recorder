import { insertMarketSnapshot } from "../db/repositories/market-snapshots";

export interface SnapshotData {
	time: Date;
	marketId: number;
	elapsedSeconds: number;
	remainingSeconds: number;

	btcPrice: number | null;

	upBid: number | null;
	upAsk: number | null;
	upMid: number | null;
	upLast: number | null;

	downBid: number | null;
	downAsk: number | null;
	downMid: number | null;
	downLast: number | null;
}

export async function writeSnapshot(snapshot: SnapshotData): Promise<void> {
	await insertMarketSnapshot(snapshot);
}
