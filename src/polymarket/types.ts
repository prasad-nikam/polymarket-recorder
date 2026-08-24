export interface GammaEvent {
	id: string;
	ticker: string;
	slug: string;
	title: string;

	startDate: string;
	endDate: string;

	active: boolean;
	closed: boolean;

	seriesSlug?: string;

	markets: GammaMarket[];
}

export interface GammaMarket {
	id: string;
	question: string;
	conditionId: string;
	slug: string;

	startDate: string;
	endDate: string;

	active: boolean;
	closed: boolean;

	acceptingOrders?: boolean;
	enableOrderBook: boolean;

	outcomes: string;
	outcomePrices: string;
	clobTokenIds: string;
}
