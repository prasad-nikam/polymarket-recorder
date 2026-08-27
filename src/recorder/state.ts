export interface TokenState {
	bestBid: number | null;
	bestAsk: number | null;

	lastTradePrice: number | null;
	lastTradeSize: number | null;
	lastTradeSide: "BUY" | "SELL" | null;

	/**
	 * Timestamp of the latest book/price update for this token.
	 * This is the exchange event timestamp, not our snapshot time.
	 */
	updatedAt: number | null;

	/**
	 * Timestamp of the latest trade event for this token.
	 */
	lastTradeAt: number | null;
}

export interface MarketState {
	up: TokenState;
	down: TokenState;

	/**
	 * Timestamp of the latest CLOB market event received
	 * for either token.
	 */
	lastEventAt: number | null;
}

export function createTokenState(): TokenState {
	return {
		bestBid: null,
		bestAsk: null,

		lastTradePrice: null,
		lastTradeSize: null,
		lastTradeSide: null,

		updatedAt: null,
		lastTradeAt: null,
	};
}

export function createMarketState(): MarketState {
	return {
		up: createTokenState(),
		down: createTokenState(),

		lastEventAt: null,
	};
}
