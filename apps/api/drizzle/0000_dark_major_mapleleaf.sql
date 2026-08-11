CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"clerk_id" text NOT NULL,
	"plan_approval_mode" text DEFAULT 'MANUAL_REVIEW' NOT NULL,
	"model_key" text DEFAULT 'groq:llama-4-scout' NOT NULL,
	"encrypted_api_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id")
);
