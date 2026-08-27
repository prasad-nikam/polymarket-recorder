import WebSocket from "ws";

import { createMarketState, type MarketState } from "../recorder/state.js";

const CLOB_WS_URL = "wss://ws-subscriptions-clob.polymarket.com/ws/market";

const PING_INTERVAL_MS = 10_000;
const PONG_TIMEOUT_MS = 5_000;

const RECONNECT_INITIAL_DELAY_MS = 1_000;
const RECONNECT_MAX_DELAY_MS = 30_000;

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

	private pingTimer: NodeJS.Timeout | null = null;
	private pongTimeoutTimer: NodeJS.Timeout | null = null;
	private reconnectTimer: NodeJS.Timeout | null = null;

	private shouldReconnect = true;
	private reconnectAttempt = 0;

	constructor(private readonly options: ClobClientOptions) {}

	connect(): void {
		this.shouldReconnect = true;

		if (this.ws) {
			return;
		}

		this.createConnection();
	}

	close(): void {
		this.shouldReconnect = false;

		this.clearHeartbeat();
		this.clearReconnectTimer();

		const ws = this.ws;

		if (!ws) {
			return;
		}

		this.ws = null;

		if (ws.readyState === WebSocket.CONNECTING) {
			ws.terminate();
			return;
		}

		ws.removeAllListeners();
		ws.close();
	}

	getState(): MarketState {
		return this.state;
	}

	private createConnection(): void {
		if (!this.shouldReconnect || this.ws) {
			return;
		}

		console.log(
			`Connecting to CLOB WebSocket${
				this.reconnectAttempt > 0
					? ` (attempt ${this.reconnectAttempt})`
					: ""
			}...`,
		);

		const ws = new WebSocket(CLOB_WS_URL);

		this.ws = ws;

		ws.on("open", () => {
			if (this.ws !== ws) {
				return;
			}

			console.log("CLOB WebSocket connected");

			this.reconnectAttempt = 0;

			this.subscribe();
			this.startHeartbeat();
		});

		ws.on("message", (data) => {
			if (this.ws !== ws) {
				return;
			}

			this.handleMessage(data.toString());
		});

		ws.on("error", (error) => {
			if (this.ws !== ws) {
				return;
			}

			console.error("CLOB WebSocket error:", error);
		});

		ws.on("close", (code, reason) => {
			if (this.ws !== ws) {
				return;
			}

			console.log("CLOB WebSocket closed:", code, reason.toString());

			this.clearHeartbeat();
			this.ws = null;

			if (this.shouldReconnect) {
				this.scheduleReconnect();
			}
		});
	}

	private scheduleReconnect(): void {
		if (!this.shouldReconnect || this.reconnectTimer) {
			return;
		}

		const delay = Math.min(
			RECONNECT_INITIAL_DELAY_MS * 2 ** this.reconnectAttempt,
			RECONNECT_MAX_DELAY_MS,
		);

		this.reconnectAttempt += 1;

		console.log(`Reconnecting to CLOB WebSocket in ${delay}ms...`);

		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;

			if (!this.shouldReconnect || this.ws) {
				return;
			}

			this.createConnection();
		}, delay);
	}

	private startHeartbeat(): void {
		this.clearHeartbeat();

		this.pingTimer = setInterval(() => {
			this.sendPing();
		}, PING_INTERVAL_MS);

		this.sendPing();
	}

	private sendPing(): void {
		const ws = this.ws;

		if (!ws || ws.readyState !== WebSocket.OPEN) {
			return;
		}

		try {
			ws.send("PING");

			this.clearPongTimeout();

			this.pongTimeoutTimer = setTimeout(() => {
				if (this.ws !== ws) {
					return;
				}

				console.warn(
					"CLOB WebSocket PONG timeout. Terminating connection...",
				);

				ws.terminate();
			}, PONG_TIMEOUT_MS);
		} catch (error) {
			console.error("Failed to send CLOB WebSocket PING:", error);

			ws.terminate();
		}
	}

	private handlePong(): void {
		this.clearPongTimeout();
	}

	private clearHeartbeat(): void {
		if (this.pingTimer) {
			clearInterval(this.pingTimer);
			this.pingTimer = null;
		}

		this.clearPongTimeout();
	}

	private clearPongTimeout(): void {
		if (this.pongTimeoutTimer) {
			clearTimeout(this.pongTimeoutTimer);
			this.pongTimeoutTimer = null;
		}
	}

	private clearReconnectTimer(): void {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
	}

	private subscribe(): void {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
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
		if (message === "PONG") {
			this.handlePong();
			return;
		}

		let parsed: unknown;

		try {
			parsed = JSON.parse(message);
		} catch (error) {
			console.warn(
				"Failed to parse CLOB WebSocket message:",
				message,
				error,
			);
			return;
		}

		// console.log(parsed);

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
