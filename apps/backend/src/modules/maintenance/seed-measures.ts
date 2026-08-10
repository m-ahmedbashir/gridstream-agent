import type { PrismaClient } from '@prisma/client';

/**
 * Seed industrial maintenance measures into the Measure table.
 * Call this from a NestJS command, a Prisma seed script, or a one-off script.
 */
export async function seedMeasures(prisma: PrismaClient): Promise<void> {
  const measures = [
    {
      category: 'predictive',
      title: 'Spindle bearing monitoring',
      titleDe: 'Spindel-Lagerüberwachung',
      description:
        'Continuous vibration monitoring of CNC spindle bearings with scheduled replacement before catastrophic failure.',
      applicableMachineTypes: ['CNC'],
      minRuntimeHours: 10000,
      typicalInvestment: 3500,
      typicalAnnualSavings: 12000,
      paybackMonths: 4,
      co2ReductionKg: 450,
      tasks: [
        { phase: 'Vibration analysis', durationDays: 1, responsibleRole: 'Maintenance technician', description: 'Record spindle vibration spectra and compare with baseline.' },
        { phase: 'Bearing replacement', durationDays: 2, responsibleRole: 'Mechanical fitter', description: 'Replace spindle bearings and reassemble headstock.' },
        { phase: 'Test run', durationDays: 1, responsibleRole: 'CNC operator', description: 'Run-in spindle and verify runout and temperature.' },
      ],
    },
    {
      category: 'energy',
      title: 'LED retrofit production hall',
      titleDe: 'LED-Umrüstung Produktionshalle',
      description:
        'Replace legacy hall lighting with LED high-bay luminaires and motion-based dimming controls.',
      applicableMachineTypes: ['CNC', 'HVAC', 'Compressor', 'Pump', 'Conveyor', 'Other'],
      typicalInvestment: 45000,
      typicalAnnualSavings: 15000,
      paybackMonths: 36,
      co2ReductionKg: 8000,
      tasks: [
        { phase: 'Lighting audit', durationDays: 2, responsibleRole: 'Energy consultant', description: 'Count fixtures, measure lux levels, and plan replacement schedule.' },
        { phase: 'Fixture installation', durationDays: 10, responsibleRole: 'Electrician', description: 'Install LED high-bay lights and configure zoning controls.' },
        { phase: 'Commissioning', durationDays: 2, responsibleRole: 'Facility manager', description: 'Verify light levels and hand over controls documentation.' },
      ],
    },
    {
      category: 'predictive',
      title: 'Preventive refrigeration unit maintenance',
      titleDe: 'Vorbeugende Wartung Kältemaschine',
      description:
        'Scheduled inspection of HVAC refrigeration circuits, compressor wear parts, and coolant pressures.',
      applicableMachineTypes: ['HVAC'],
      typicalInvestment: 8000,
      typicalAnnualSavings: 6000,
      paybackMonths: 16,
      co2ReductionKg: 1200,
      tasks: [
        { phase: 'System inspection', durationDays: 1, responsibleRole: 'HVAC technician', description: 'Check pressures, temperatures, and belt tension.' },
        { phase: 'Component replacement', durationDays: 2, responsibleRole: 'HVAC technician', description: 'Replace worn seals, filters, and contactors as needed.' },
        { phase: 'Performance test', durationDays: 1, responsibleRole: 'HVAC technician', description: 'Measure cooling capacity and log baseline values.' },
      ],
    },
    {
      category: 'efficiency',
      title: 'Compressor oil change',
      titleDe: 'Ölwechsel Kompressor',
      description:
        'Replace compressor oil and oil filter after high runtime to restore efficiency and reduce wear.',
      applicableMachineTypes: ['Compressor'],
      minRuntimeHours: 15000,
      typicalInvestment: 1200,
      typicalAnnualSavings: 2400,
      paybackMonths: 6,
      co2ReductionKg: 300,
      tasks: [
        { phase: 'Oil sampling', durationDays: 1, responsibleRole: 'Maintenance technician', description: 'Take oil sample for lab analysis and confirm change interval.' },
        { phase: 'Oil and filter change', durationDays: 1, responsibleRole: 'Mechanical fitter', description: 'Drain old oil, replace filter, and fill with specified oil.' },
        { phase: 'Run-in check', durationDays: 1, responsibleRole: 'Compressor operator', description: 'Check pressures, temperatures, and leakage after run-in.' },
      ],
    },
    {
      category: 'safety',
      title: 'Conveyor belt safety inspection',
      titleDe: 'Sicherheitsinspektion Förderband',
      description:
        'Inspect conveyor belt guards, emergency stops, and belt condition to comply with machinery safety regulations.',
      applicableMachineTypes: ['Conveyor'],
      typicalInvestment: 2500,
      typicalAnnualSavings: 1800,
      paybackMonths: 17,
      co2ReductionKg: 0,
      tasks: [
        { phase: 'Guard and ESTOP check', durationDays: 1, responsibleRole: 'Safety officer', description: 'Verify all guards and emergency stops are functional.' },
        { phase: 'Belt condition assessment', durationDays: 1, responsibleRole: 'Maintenance technician', description: 'Inspect belt wear, tracking, and splice condition.' },
        { phase: 'Documentation', durationDays: 1, responsibleRole: 'Safety officer', description: 'Update inspection log and risk assessment.' },
      ],
    },
    {
      category: 'energy',
      title: 'CNC control energy optimisation',
      titleDe: 'Energieoptimierung CNC-Steuerung',
      description:
        'Enable adaptive spindle speed and idle-state power reduction in the CNC control parameters.',
      applicableMachineTypes: ['CNC'],
      typicalInvestment: 6000,
      typicalAnnualSavings: 9000,
      paybackMonths: 8,
      co2ReductionKg: 2200,
      tasks: [
        { phase: 'Power measurement', durationDays: 1, responsibleRole: 'Energy consultant', description: 'Measure idle and cutting power consumption.' },
        { phase: 'Parameter tuning', durationDays: 2, responsibleRole: 'CNC technician', description: 'Optimise spindle ramp profiles and idle timeouts.' },
        { phase: 'Verification', durationDays: 1, responsibleRole: 'CNC operator', description: 'Run production parts and confirm power reduction without quality loss.' },
      ],
    },
    {
      category: 'efficiency',
      title: 'HVAC filter replacement',
      titleDe: 'Filterwechsel HVAC',
      description:
        'Replace clogged HVAC filters to restore airflow and reduce fan energy consumption.',
      applicableMachineTypes: ['HVAC'],
      typicalInvestment: 800,
      typicalAnnualSavings: 1600,
      paybackMonths: 6,
      co2ReductionKg: 250,
      tasks: [
        { phase: 'Filter inspection', durationDays: 1, responsibleRole: 'HVAC technician', description: 'Measure pressure drop across filters.' },
        { phase: 'Filter replacement', durationDays: 1, responsibleRole: 'HVAC technician', description: 'Install new filters and reset differential pressure gauge.' },
        { phase: 'Performance check', durationDays: 1, responsibleRole: 'HVAC technician', description: 'Verify airflow and log new baseline pressure drop.' },
      ],
    },
    {
      category: 'safety',
      title: 'Pump seal replacement',
      titleDe: 'Dichtungsersatz Pumpe',
      description:
        'Replace worn pump mechanical seals to prevent leakage and unplanned downtime.',
      applicableMachineTypes: ['Pump'],
      typicalInvestment: 1500,
      typicalAnnualSavings: 3000,
      paybackMonths: 6,
      co2ReductionKg: 0,
      tasks: [
        { phase: 'Leakage inspection', durationDays: 1, responsibleRole: 'Maintenance technician', description: 'Assess seal leakage rate and plan shutdown.' },
        { phase: 'Seal replacement', durationDays: 2, responsibleRole: 'Mechanical fitter', description: 'Remove pump casing, replace seal, and reassemble.' },
        { phase: 'Pressure test', durationDays: 1, responsibleRole: 'Maintenance technician', description: 'Run pump and verify no leakage at operating pressure.' },
      ],
    },
    {
      category: 'compliance',
      title: ' Compressed air leak detection programme',
      titleDe: 'Druckluft-Lecksuche',
      description:
        'Ultrasonic leak detection survey across compressed-air network with subsequent fitting replacement.',
      applicableMachineTypes: ['Compressor'],
      typicalInvestment: 2200,
      typicalAnnualSavings: 4200,
      paybackMonths: 6,
      co2ReductionKg: 900,
      tasks: [
        { phase: 'Leak survey', durationDays: 1, responsibleRole: 'Energy consultant', description: 'Scan distribution network with ultrasonic detector and tag leaks.' },
        { phase: 'Fitting repair', durationDays: 2, responsibleRole: 'Pipe fitter', description: 'Replace couplings, hoses, and quick-connects as needed.' },
        { phase: 'Re-verification', durationDays: 1, responsibleRole: 'Energy consultant', description: 'Re-scan repaired points and quantify savings.' },
      ],
    },
  ];

  // Idempotent seed: find by German title, then create or update.
  for (const measure of measures) {
    const existing = await prisma.measure.findFirst({
      where: { titleDe: measure.titleDe },
    });

    if (existing) {
      await prisma.measure.update({
        where: { id: existing.id },
        data: measure as any,
      });
    } else {
      await prisma.measure.create({
        data: measure as any,
      });
    }
  }

  console.log(`Seeded ${measures.length} maintenance measures.`);
}
