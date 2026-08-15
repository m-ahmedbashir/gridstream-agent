CREATE TYPE "public"."anomaly_kind" AS ENUM('THERMAL_RUNAWAY', 'VOLTAGE_SAG');--> statement-breakpoint
CREATE TYPE "public"."fault_confidence_label" AS ENUM('LOW', 'MEDIUM', 'HIGH');--> statement-breakpoint
ALTER TABLE "fault_diagnostics" ALTER COLUMN "fault_type" SET DATA TYPE "public"."anomaly_kind" USING "fault_type"::"public"."anomaly_kind";--> statement-breakpoint
ALTER TABLE "fault_diagnostics" ADD COLUMN "confidence_score" integer;--> statement-breakpoint
ALTER TABLE "fault_diagnostics" ADD COLUMN "confidence_label" "fault_confidence_label";--> statement-breakpoint
ALTER TABLE "fault_diagnostics" ADD COLUMN "confidence_factors" jsonb;--> statement-breakpoint
ALTER TABLE "fault_diagnostics" ADD COLUMN "execution_trace" jsonb;