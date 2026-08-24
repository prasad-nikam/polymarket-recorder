import { getMidPrice, isMarketStateReady, type MarketState } from "./state.js";

import { insertMarketSnapshot } from "../db/repositories/market-snapshots.js";

interface SnapshotterOptions {
	marketId: number;
	startTime: Date;
	endTime: Date;
	getState: () => MarketState;
}

export class Snapshotter {
	private timer: NodeJS.Timeout | null = null;
	private resolveFinished: (() => void) | null = null;
	constructor(private readonly options: SnapshotterOptions) {}

	start(): Promise<void> {
		if (this.timer) {
			return Promise.resolve();
		}

		return new Promise((resolve) => {
			this.resolveFinished = resolve;
			this.scheduleNext();
		});
	}

	stop(): void {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}

		if (this.resolveFinished) {
			this.resolveFinished();
			this.resolveFinished = null;
		}
	}

	private scheduleNext(): void {
		const now = Date.now();

		const nextSecond = Math.floor(now / 1000) * 1000 + 1000;

		const delay = nextSecond - now;

		this.timer = setTimeout(async () => {
			this.timer = null;

			const shouldContinue = await this.takeSnapshot(
				new Date(nextSecond),
			);

			if (shouldContinue) {
				this.scheduleNext();
			}
		}, delay);
	}

	private async takeSnapshot(snapshotTime: Date): Promise<boolean> {
		const now = new Date();

		const startMs = this.options.startTime.getTime();
		const endMs = this.options.endTime.getTime();
		const nowMs = now.getTime();

		// The market has ended according to Gamma.
		if (nowMs >= endMs) {
			console.log(
				`Market ${this.options.marketId} ended at ${now.toISOString()}`,
			);

			this.resolveFinished?.();
			this.resolveFinished = null;

			return false;
		}

		const elapsedSeconds = Math.max(
			0,
			Math.floor((nowMs - startMs) / 1000),
		);

		const remainingSeconds = Math.max(0, Math.ceil((endMs - nowMs) / 1000));

		const state = this.options.getState();

		if (!isMarketStateReady(state)) {
			return true;
		}

		await insertMarketSnapshot({
			time: snapshotTime,
			marketId: this.options.marketId,

			elapsedSeconds,
			remainingSeconds,

			btcPrice: null,

			upBid: state.up.bestBid,
			upAsk: state.up.bestAsk,
			upMid: getMidPrice(state.up),
			upLast: state.up.lastTradePrice,

			downBid: state.down.bestBid,
			downAsk: state.down.bestAsk,
			downMid: getMidPrice(state.down),
			downLast: state.down.lastTradePrice,
		});

		console.log(
			`${snapshotTime.toISOString()} | ` +
				`UP ${state.up.bestBid} / ${state.up.bestAsk} | ` +
				`DOWN ${state.down.bestBid} / ${state.down.bestAsk}`,
		);

		return true;
	}
}
