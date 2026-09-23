CREATE TYPE "public"."interaction_kind" AS ENUM('impression', 'open', 'dwell', 'save', 'hide', 'up', 'down');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."match_method" AS ENUM('seed', 'url', 'trigram', 'embedding', 'llm');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('telegram');--> statement-breakpoint
CREATE TYPE "public"."source_health" AS ENUM('unknown', 'ok', 'degraded', 'failing');--> statement-breakpoint
CREATE TABLE "interactions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "interactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" bigint NOT NULL,
	"story_id" bigint NOT NULL,
	"kind" "interaction_kind" NOT NULL,
	"value" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "job_runs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"job_name" text NOT NULL,
	"job_id" text,
	"attempt" smallint DEFAULT 1 NOT NULL,
	"status" "job_status" DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"items_in" integer DEFAULT 0 NOT NULL,
	"items_out" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(12, 6) DEFAULT 0 NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "notifications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" bigint NOT NULL,
	"story_id" bigint NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reason" text NOT NULL,
	"feedback" text
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" bigint PRIMARY KEY NOT NULL,
	"topic_weights" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"embedding" vector(1024),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_items" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "raw_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"source_id" bigint NOT NULL,
	"external_id" text NOT NULL,
	"url" text NOT NULL,
	"canonical_url" text,
	"title" text NOT NULL,
	"body_snippet" varchar(500),
	"author" text,
	"published_at" timestamp with time zone,
	"engagement" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"raw" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sources_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"collector" text NOT NULL,
	"name" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"health" "source_health" DEFAULT 'unknown' NOT NULL,
	"last_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sources_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "stories" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"cluster_key" text,
	"title" text NOT NULL,
	"summary_short" text,
	"summary_deep" text,
	"explainer" text,
	"topics" text[] DEFAULT '{}' NOT NULL,
	"entities" jsonb,
	"geo" jsonb,
	"importance" smallint,
	"embedding" vector(1024),
	"embedding_model" text,
	"lang" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_count" smallint DEFAULT 1 NOT NULL,
	"enriched_at" timestamp with time zone,
	CONSTRAINT "stories_importance_range" CHECK ("stories"."importance" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "story_items" (
	"story_id" bigint NOT NULL,
	"raw_item_id" bigint NOT NULL,
	"match_method" "match_method" NOT NULL,
	"confidence" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "story_items_story_id_raw_item_id_pk" PRIMARY KEY("story_id","raw_item_id"),
	CONSTRAINT "story_items_confidence_range" CHECK ("story_items"."confidence" between 0 and 1)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_items" ADD CONSTRAINT "raw_items_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_items" ADD CONSTRAINT "story_items_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_items" ADD CONSTRAINT "story_items_raw_item_id_raw_items_id_fk" FOREIGN KEY ("raw_item_id") REFERENCES "public"."raw_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "interactions_user_created_at_idx" ON "interactions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "interactions_story_idx" ON "interactions" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX "job_runs_job_name_started_at_idx" ON "job_runs" USING btree ("job_name","started_at");--> statement-breakpoint
CREATE INDEX "notifications_story_idx" ON "notifications" USING btree ("story_id");--> statement-breakpoint
CREATE UNIQUE INDEX "raw_items_source_external_key" ON "raw_items" USING btree ("source_id","external_id");--> statement-breakpoint
CREATE INDEX "raw_items_canonical_url_idx" ON "raw_items" USING btree ("canonical_url");--> statement-breakpoint
CREATE INDEX "raw_items_fetched_at_idx" ON "raw_items" USING btree ("fetched_at");--> statement-breakpoint
CREATE INDEX "stories_last_activity_at_idx" ON "stories" USING btree ("last_activity_at");--> statement-breakpoint
CREATE INDEX "stories_importance_idx" ON "stories" USING btree ("importance");--> statement-breakpoint
CREATE INDEX "story_items_raw_item_idx" ON "story_items" USING btree ("raw_item_id");