CREATE TABLE "market_snapshots" (
	"time" timestamp with time zone NOT NULL,
	"market_id" bigint NOT NULL,
	"elapsed_seconds" smallint NOT NULL,
	"remaining_seconds" smallint NOT NULL,
	"btc_price" numeric(12, 2),
	"up_bid" numeric(6, 5),
	"up_ask" numeric(6, 5),
	"up_mid" numeric(6, 5),
	"up_last" numeric(6, 5),
	"down_bid" numeric(6, 5),
	"down_ask" numeric(6, 5),
	"down_mid" numeric(6, 5),
	"down_last" numeric(6, 5)
);
--> statement-breakpoint
CREATE TABLE "markets" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"condition_id" text NOT NULL,
	"slug" text NOT NULL,
	"question" text NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"up_token_id" text NOT NULL,
	"down_token_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "markets_condition_id_unique" UNIQUE("condition_id")
);
--> statement-breakpoint
ALTER TABLE "market_snapshots" ADD CONSTRAINT "market_snapshots_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "snapshots_market_time_idx" ON "market_snapshots" USING btree ("market_id","time");--> statement-breakpoint
CREATE INDEX "markets_start_time_idx" ON "markets" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "markets_end_time_idx" ON "markets" USING btree ("end_time");