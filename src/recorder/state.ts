export interface TokenState {
	bestBid: number | null;
	bestAsk: number | null;

	lastTradePrice: number | null;
	lastTradeSize: number | null;
	lastTradeSide: "BUY" | "SELL" | null;

	updatedAt: number | null;
	lastTradeAt: number | null;
}

export interface MarketState {
	up: TokenState;
	down: TokenState;

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

export function getMidPrice(token: TokenState): number | null {
	if (token.bestBid === null || token.bestAsk === null) {
		return null;
	}

	return (token.bestBid + token.bestAsk) / 2;
}

export function isMarketStateReady(state: MarketState): boolean {
	return (
		state.up.bestBid !== null &&
		state.up.bestAsk !== null &&
		state.down.bestBid !== null &&
		state.down.bestAsk !== null
	);
}
