import type { ClobClient } from "../polymarket/clob.client.js";
import type { Market } from "../polymarket/types.js";
import { writeSnapshot } from "./writer.js";

const SNAPSHOT_INTERVAL_MS = 1_000;

export class Snapshotter {
	private timer: NodeJS.Timeout | null = null;
	private stopTimer: NodeJS.Timeout | null = null;
	private running = false;

	constructor(
		private readonly market: Market,
		private readonly clobClient: ClobClient,
	) {}

	start(): Promise<void> {
		if (this.running) {
			return Promise.resolve();
		}

		this.running = true;

		// Take the first snapshot immediately.
		this.takeSnapshot();

		this.timer = setInterval(() => {
			this.takeSnapshot();
		}, SNAPSHOT_INTERVAL_MS);

		const endMs = this.market.endTime.getTime();
		const delayMs = Math.max(0, endMs - Date.now());

		return new Promise((resolve) => {
			this.stopTimer = setTimeout(() => {
				this.stopTimer = null;
				this.stop();
				resolve();
			}, delayMs);
		});
	}

	stop(): void {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}

		if (this.stopTimer) {
			clearTimeout(this.stopTimer);
			this.stopTimer = null;
		}

		this.running = false;
	}

	private takeSnapshot(): void {
		if (!this.running) {
			return;
		}

		const now = new Date();
		const state = this.clobClient.getState();

		const startMs = this.market.startTime.getTime();
		const endMs = this.market.endTime.getTime();
		const nowMs = now.getTime();

		const elapsedSeconds = Math.max(
			0,
			Math.floor((nowMs - startMs) / 1_000),
		);

		const remainingSeconds = Math.max(
			0,
			Math.ceil((endMs - nowMs) / 1_000),
		);

		const upMid = calculateMid(state.up.bestBid, state.up.bestAsk);

		const downMid = calculateMid(state.down.bestBid, state.down.bestAsk);

		void writeSnapshot({
			time: now,
			marketId: this.market.id,
			elapsedSeconds,
			remainingSeconds,

			btcPrice: null,

			upBid: state.up.bestBid,
			upAsk: state.up.bestAsk,
			upMid,
			upLast: state.up.lastTradePrice,

			downBid: state.down.bestBid,
			downAsk: state.down.bestAsk,
			downMid,
			downLast: state.down.lastTradePrice,
		});
	}
}

function calculateMid(bid: number | null, ask: number | null): number | null {
	if (bid === null || ask === null) {
		return null;
	}

	return (bid + ask) / 2;
}
