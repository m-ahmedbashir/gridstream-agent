import { z } from 'zod';

// ── Machine types shared across the maintenance domain ───────────────────────

export const MachineType = z.enum(['CNC', 'HVAC', 'Compressor', 'Pump', 'Conveyor', 'Other']);
export type MachineType = z.infer<typeof MachineType>;

export const Criticality = z.enum(['low', 'medium', 'high', 'critical']);
export type Criticality = z.infer<typeof Criticality>;

export const MeasureCategory = z.enum(['predictive', 'energy', 'safety', 'efficiency', 'compliance']);
export type MeasureCategory = z.infer<typeof MeasureCategory>;

export const PlanStatus = z.enum(['draft', 'approved', 'rejected']);
export type PlanStatus = z.infer<typeof PlanStatus>;

export const MeasurePriority = z.enum(['immediate', 'scheduled', 'planned']);
export type MeasurePriority = z.infer<typeof MeasurePriority>;

// ── MachineProfile ───────────────────────────────────────────────────────────

export const MachineProfileSchema = z
  .object({
    machineId: z.string().describe('Unique machine identifier from the document'),
    machineType: MachineType.describe('Type of industrial machine'),
    manufacturer: z.string().describe('Machine manufacturer or vendor'),
    yearInstalled: z.number().int().min(1900).max(2030).describe('Year the machine was installed'),
    runtimeHours: z.number().int().min(0).describe('Total operating hours'),
    lastServiceDate: z.string().datetime().optional().describe('ISO datetime of last service, if known'),
    observedIssues: z.array(z.string()).describe('List of observed issues from the report'),
    energyConsumptionKwh: z.number().optional().describe('Energy consumption per hour in kWh, if stated'),
    criticality: Criticality.describe('Criticality level for production'),
    location: z.string().optional().describe('Physical location in the plant, if stated'),
  })
  .strict();

export type MachineProfile = z.infer<typeof MachineProfileSchema>;

/**
 * Confidence score for each extracted machine-profile field.
 * Uses a six-anchor scale: 0.0, 0.2, 0.4, 0.6, 0.8, 1.0.
 */
export const MachineProfileConfidenceSchema = z.object({
  machineId: z.number().describe('Confidence 0.0–1.0 for machineId'),
  machineType: z.number().describe('Confidence 0.0–1.0 for machineType'),
  manufacturer: z.number().describe('Confidence 0.0–1.0 for manufacturer'),
  yearInstalled: z.number().describe('Confidence 0.0–1.0 for yearInstalled'),
  runtimeHours: z.number().describe('Confidence 0.0–1.0 for runtimeHours'),
  lastServiceDate: z.number().describe('Confidence 0.0–1.0 for lastServiceDate'),
  observedIssues: z.number().describe('Confidence 0.0–1.0 for observedIssues array'),
  energyConsumptionKwh: z.number().describe('Confidence 0.0–1.0 for energyConsumptionKwh'),
  criticality: z.number().describe('Confidence 0.0–1.0 for criticality'),
  location: z.number().describe('Confidence 0.0–1.0 for location'),
});

export type MachineProfileConfidence = z.infer<typeof MachineProfileConfidenceSchema>;

// ── Task (nested in Measure and ProjectPlan) ─────────────────────────────────

export const MaintenanceTaskSchema = z.object({
  phase: z.string(),
  durationDays: z.number().int(),
  responsibleRole: z.string(),
  description: z.string(),
});

export type MaintenanceTask = z.infer<typeof MaintenanceTaskSchema>;

// ── Measure ──────────────────────────────────────────────────────────────────

export const MeasureSchema = z
  .object({
    id: z.string(),
    category: MeasureCategory,
    title: z.string(),
    titleDe: z.string(),
    description: z.string(),
    applicableMachineTypes: z.array(MachineType),
    minRuntimeHours: z.number().optional(),
    typicalInvestment: z.number().int().describe('Typical investment in EUR'),
    typicalAnnualSavings: z.number().int().describe('Typical annual savings in EUR'),
    paybackMonths: z.number().describe('Typical payback period in months'),
    co2ReductionKg: z.number().optional().describe('Optional CO2 reduction in kg per year'),
    tasks: z.array(MaintenanceTaskSchema),
  })
  .strict();

export type Measure = z.infer<typeof MeasureSchema>;

// ── ProjectPlan ──────────────────────────────────────────────────────────────

export const PlannedMeasureSchema = z.object({
  measureId: z.string(),
  title: z.string(),
  titleDe: z.string(),
  priority: MeasurePriority,
  investment: z.number(),
  annualSavings: z.number(),
  paybackMonths: z.number(),
  tasks: z.array(MaintenanceTaskSchema),
});

export type PlannedMeasure = z.infer<typeof PlannedMeasureSchema>;

export const ProjectPlanSchema = z
  .object({
    planId: z.string(),
    machineId: z.string(),
    status: PlanStatus,
    totalInvestment: z.number().int(),
    totalAnnualSavings: z.number().int(),
    paybackMonths: z.number(),
    totalDowntimeHours: z.number().optional(),
    totalCo2ReductionKg: z.number().optional(),
    confidence: z.number().min(0).max(1),
    measures: z.array(PlannedMeasureSchema),
    executiveSummary: z.string().describe('German executive summary for the plant manager'),
    executiveSummaryEn: z.string().optional().describe('English backup of the executive summary'),
    generatedAt: z.string().datetime(),
  })
  .strict();

export type ProjectPlan = z.infer<typeof ProjectPlanSchema>;

/**
 * Confidence score for the generated project plan.
 * Uses a six-anchor scale: 0.0, 0.2, 0.4, 0.6, 0.8, 1.0.
 */
export const ProjectPlanConfidenceSchema = z.object({
  totalInvestment: z.number(),
  totalAnnualSavings: z.number(),
  paybackMonths: z.number(),
  totalDowntimeHours: z.number(),
  totalCo2ReductionKg: z.number(),
  confidence: z.number(),
  measures: z.number(),
  executiveSummary: z.number(),
});

export type ProjectPlanConfidence = z.infer<typeof ProjectPlanConfidenceSchema>;
