import { eq } from "drizzle-orm";

import { db } from "../client.js";
import { markets } from "../schema.js";

export interface InsertMarketInput {
	conditionId: string;
	slug: string;
	question: string;

	startTime: Date;
	endTime: Date;

	upTokenId: string;
	downTokenId: string;
}

export async function upsertMarket(input: InsertMarketInput) {
	const existing = await db
		.select()
		.from(markets)
		.where(eq(markets.conditionId, input.conditionId))
		.limit(1);

	if (existing.length > 0) {
		return existing[0];
	}

	const [market] = await db.insert(markets).values(input).returning();

	return market;
}
