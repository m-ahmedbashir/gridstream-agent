CREATE TYPE "public"."device_status" AS ENUM('ONLINE', 'OFFLINE', 'MAINTENANCE');--> statement-breakpoint
CREATE TYPE "public"."device_type" AS ENUM('SOLAR', 'BATTERY', 'HEAT_PUMP', 'WALLBOX');--> statement-breakpoint
CREATE TYPE "public"."fault_severity" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."fault_status" AS ENUM('PENDING_APPROVAL', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TABLE "device_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"device_type" "device_type" NOT NULL,
	"serial_number" text NOT NULL,
	"location" text,
	"status" "device_status" DEFAULT 'OFFLINE' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "device_assets_serial_number_unique" UNIQUE("serial_number")
);
--> statement-breakpoint
CREATE TABLE "fault_diagnostics" (
	"id" text PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"severity" "fault_severity" NOT NULL,
	"fault_type" text NOT NULL,
	"summary" text NOT NULL,
	"recommended_action" text NOT NULL,
	"requires_immediate_dispatch" boolean DEFAULT false NOT NULL,
	"status" "fault_status" DEFAULT 'PENDING_APPROVAL' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telemetry_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"solar_production_kwh" real,
	"battery_soc" real,
	"battery_temp_celsius" real,
	"grid_voltage" real
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"clerk_id" text NOT NULL,
	"plan_approval_mode" text DEFAULT 'MANUAL_REVIEW' NOT NULL,
	"model_key" text DEFAULT 'openrouter:nemotron-nano-12b-v2-vl-free' NOT NULL,
	"encrypted_api_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id")
);
--> statement-breakpoint
ALTER TABLE "fault_diagnostics" ADD CONSTRAINT "fault_diagnostics_device_id_device_assets_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."device_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telemetry_logs" ADD CONSTRAINT "telemetry_logs_device_id_device_assets_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."device_assets"("id") ON DELETE cascade ON UPDATE no action;