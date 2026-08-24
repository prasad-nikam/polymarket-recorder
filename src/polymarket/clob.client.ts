import WebSocket from "ws";

import { createMarketState, type MarketState } from "../recorder/state.js";

const CLOB_WS_URL = "wss://ws-subscriptions-clob.polymarket.com/ws/market";

interface PriceChange {
	asset_id: string;
	price: string;
	size: string;
	side: "BUY" | "SELL";
	hash: string;
	best_bid: string;
	best_ask: string;
}

interface PriceChangeEvent {
	market: string;
	price_changes: PriceChange[];
	timestamp: string;
	event_type: "price_change";
}

interface BookLevel {
	price: string;
	size: string;
}

interface BookEvent {
	market: string;
	asset_id: string;
	bids: BookLevel[];
	asks: BookLevel[];
	hash: string;
	timestamp: string;
	event_type: "book";
	last_trade_price?: string;
	tick_size?: string;
}

interface LastTradePriceEvent {
	market: string;
	asset_id: string;
	price: string;
	size: string;
	fee_rate_bps: string;
	side: "BUY" | "SELL";
	timestamp: string;
	event_type: "last_trade_price";
	transaction_hash: string;
}

type ClobEvent = PriceChangeEvent | BookEvent | LastTradePriceEvent;

export interface ClobClientOptions {
	upTokenId: string;
	downTokenId: string;
}

export class ClobClient {
	private ws: WebSocket | null = null;

	private readonly state: MarketState = createMarketState();

	constructor(private readonly options: ClobClientOptions) {}

	connect(): void {
		this.ws = new WebSocket(CLOB_WS_URL);

		this.ws.on("open", () => {
			console.log("CLOB WebSocket connected");

			this.subscribe();
		});

		this.ws.on("message", (data) => {
			this.handleMessage(data.toString());
		});

		this.ws.on("error", (error) => {
			console.error("CLOB WebSocket error:", error);
		});

		this.ws.on("close", (code, reason) => {
			console.log("CLOB WebSocket closed:", code, reason.toString());
		});
	}

	close(): void {
		if (!this.ws) {
			return;
		}

		this.ws.close();
		this.ws = null;
	}

	getState(): MarketState {
		return this.state;
	}

	private subscribe(): void {
		if (!this.ws) {
			return;
		}

		const message = {
			assets_ids: [this.options.upTokenId, this.options.downTokenId],
			type: "market",
		};

		console.log("\nSUBSCRIBING:");
		console.log(JSON.stringify(message, null, 2));

		this.ws.send(JSON.stringify(message));
	}

	private handleLastTradePrice(event: LastTradePriceEvent): void {
		const tokenState = this.getTokenState(event.asset_id);

		if (!tokenState) {
			return;
		}

		const timestamp = Number(event.timestamp);

		tokenState.lastTradePrice = Number(event.price);
		tokenState.lastTradeSize = Number(event.size);
		tokenState.lastTradeSide = event.side;
		tokenState.lastTradeAt = timestamp;

		this.state.lastEventAt = timestamp;
	}

	private handleEvent(event: unknown): void {
		if (
			typeof event !== "object" ||
			event === null ||
			!("event_type" in event)
		) {
			console.log("Unknown CLOB event:", event);
			return;
		}

		const typedEvent = event as ClobEvent;

		switch (typedEvent.event_type) {
			case "price_change":
				this.handlePriceChange(typedEvent);
				break;

			case "book":
				this.handleBook(typedEvent);
				break;

			case "last_trade_price":
				this.handleLastTradePrice(typedEvent);
				break;

			default:
				console.log("Unknown CLOB event:", typedEvent);
		}
	}

	private handleMessage(message: string): void {
		const parsed: unknown = JSON.parse(message);

		if (Array.isArray(parsed)) {
			for (const item of parsed) {
				this.handleEvent(item);
			}

			return;
		}

		this.handleEvent(parsed);
	}

	private handlePriceChange(event: PriceChangeEvent): void {
		const eventTimestamp = Number(event.timestamp);

		this.state.lastEventAt = eventTimestamp;

		for (const change of event.price_changes) {
			const tokenState = this.getTokenState(change.asset_id);

			if (!tokenState) {
				continue;
			}
			tokenState.bestBid = Number(change.best_bid);
			tokenState.bestAsk = Number(change.best_ask);

			tokenState.updatedAt = eventTimestamp;
		}
	}

	private handleBook(event: BookEvent): void {
		const tokenState = this.getTokenState(event.asset_id);

		if (!tokenState) {
			return;
		}

		const timestamp = Number(event.timestamp);

		this.state.lastEventAt = timestamp;

		/*
		 * For the initial book snapshot we derive:
		 *
		 * best bid = highest bid
		 * best ask = lowest ask
		 */

		if (event.bids.length > 0) {
			const bestBid = Math.max(
				...event.bids.map((level) => Number(level.price)),
			);

			tokenState.bestBid = bestBid;
		}

		if (event.asks.length > 0) {
			const bestAsk = Math.min(
				...event.asks.map((level) => Number(level.price)),
			);

			tokenState.bestAsk = bestAsk;
		}

		if (event.last_trade_price !== undefined) {
			tokenState.lastTradePrice = Number(event.last_trade_price);
		}

		tokenState.updatedAt = timestamp;
	}

	// private getTokenState(assetId: string) {
	// 	if (assetId === this.options.upTokenId) {
	// 		return this.state.up;
	// 	}

	// 	if (assetId === this.options.downTokenId) {
	// 		return this.state.down;
	// 	}

	// 	return null;
	// }

	private getTokenState(assetId: string) {
		if (assetId === this.options.upTokenId) {
			return this.state.up;
		}

		if (assetId === this.options.downTokenId) {
			return this.state.down;
		}

		return null;
	}
}
