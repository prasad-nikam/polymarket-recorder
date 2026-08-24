import {
	pgTable,
	bigserial,
	bigint,
	timestamp,
	smallint,
	numeric,
	text,
	index,
} from "drizzle-orm/pg-core";

export const markets = pgTable(
	"markets",
	{
		id: bigserial("id", { mode: "number" }).primaryKey(),

		conditionId: text("condition_id").notNull().unique(),
		slug: text("slug").notNull(),
		question: text("question").notNull(),

		startTime: timestamp("start_time", {
			withTimezone: true,
		}).notNull(),

		endTime: timestamp("end_time", {
			withTimezone: true,
		}).notNull(),

		upTokenId: text("up_token_id").notNull(),
		downTokenId: text("down_token_id").notNull(),

		createdAt: timestamp("created_at", {
			withTimezone: true,
		})
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("markets_start_time_idx").on(table.startTime),
		index("markets_end_time_idx").on(table.endTime),
	],
);

export const marketSnapshots = pgTable(
	"market_snapshots",
	{
		time: timestamp("time", {
			withTimezone: true,
		}).notNull(),

		marketId: bigint("market_id", {
			mode: "number",
		})
			.notNull()
			.references(() => markets.id),

		elapsedSeconds: smallint("elapsed_seconds").notNull(),
		remainingSeconds: smallint("remaining_seconds").notNull(),

		btcPrice: numeric("btc_price", {
			precision: 12,
			scale: 2,
		}),

		upBid: numeric("up_bid", {
			precision: 6,
			scale: 5,
		}),

		upAsk: numeric("up_ask", {
			precision: 6,
			scale: 5,
		}),

		upMid: numeric("up_mid", {
			precision: 6,
			scale: 5,
		}),

		upLast: numeric("up_last", {
			precision: 6,
			scale: 5,
		}),

		downBid: numeric("down_bid", {
			precision: 6,
			scale: 5,
		}),

		downAsk: numeric("down_ask", {
			precision: 6,
			scale: 5,
		}),

		downMid: numeric("down_mid", {
			precision: 6,
			scale: 5,
		}),

		downLast: numeric("down_last", {
			precision: 6,
			scale: 5,
		}),
	},
	(table) => [
		index("snapshots_market_time_idx").on(table.marketId, table.time),
	],
);
