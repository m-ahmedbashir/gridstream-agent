'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Line, LineChart, CartesianGrid, XAxis, YAxis, ReferenceLine } from 'recharts';
import { useTelemetry, type ReadingStatus } from './use-telemetry';
import { useMachineProfiles } from './use-machine-profiles';
import { useCreateMachine } from './use-create-machine';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { IconAlertTriangle, IconActivity, IconPlus } from '@tabler/icons-react';

const MACHINE_TYPES = ['CNC', 'HVAC', 'Compressor', 'Pump', 'Conveyor', 'Other'];
const CRITICALITY_LEVELS = ['low', 'medium', 'high', 'critical'];

const STATUS_STYLES: Record<ReadingStatus, string> = {
    normal: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
    warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400',
    critical: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
};

const CRITICALITY_STYLES: Record<string, string> = {
    low: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
    medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400',
    critical: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
};

const chartConfig = {
    value: {
        label: 'Operating temperature',
        color: 'var(--primary)',
    },
} satisfies ChartConfig;

function QuickAddMachineForm({ onCreated }: { onCreated: (id: string) => void }) {
    const { mutateAsync: createMachine, isPending } = useCreateMachine();
    const [machineId, setMachineId] = useState('');
    const [machineType, setMachineType] = useState('CNC');
    const [criticality, setCriticality] = useState('medium');
    const [location, setLocation] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!machineId.trim()) return;
        try {
            const result = await createMachine({ machineId: machineId.trim(), machineType, criticality, location: location.trim() || undefined });
            onCreated(result.id);
        } catch {
            // useCreateMachine already toasts the error
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                    <IconPlus className='h-4 w-4' />
                    Add a Machine
                </CardTitle>
                <CardDescription>No document needed — name it, pick a type, and start watching it live.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className='grid grid-cols-1 gap-4 sm:grid-cols-4 sm:items-end'>
                    <div className='space-y-1.5 sm:col-span-2'>
                        <Label htmlFor='machineId'>Name / Asset ID</Label>
                        <Input id='machineId' value={machineId} onChange={(e) => setMachineId(e.target.value)} placeholder='e.g. Compressor Halle 4' required />
                    </div>
                    <div className='space-y-1.5'>
                        <Label>Type</Label>
                        <Select value={machineType} onValueChange={setMachineType}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {MACHINE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className='space-y-1.5'>
                        <Label>Criticality</Label>
                        <Select value={criticality} onValueChange={setCriticality}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {CRITICALITY_LEVELS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className='space-y-1.5 sm:col-span-2'>
                        <Label htmlFor='location'>Location (optional)</Label>
                        <Input id='location' value={location} onChange={(e) => setLocation(e.target.value)} placeholder='e.g. Halle 4' />
                    </div>
                    <Button type='submit' disabled={isPending || !machineId.trim()}>
                        {isPending ? 'Adding…' : 'Add & Watch Live'}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}

function MachinePicker() {
    const router = useRouter();
    const { data, isPending, error } = useMachineProfiles();
    const machines = data?.machines ?? [];

    const goToMachine = (id: string) => router.push(`/dashboard/maintenance/live?machineProfileId=${id}`);

    return (
        <div className='space-y-6'>
            <QuickAddMachineForm onCreated={goToMachine} />

            <Card>
                <CardHeader>
                    <CardTitle>Choose a machine to monitor</CardTitle>
                    <CardDescription>
                        {machines.some((m) => m.isDemo)
                            ? 'A few demo machines are seeded automatically so this page is never empty — add your own above any time.'
                            : 'Pick a machine profile to see its live telemetry.'}
                    </CardDescription>
                </CardHeader>
                <CardContent className='space-y-2'>
                    {isPending && <p className='text-muted-foreground'>Loading machines…</p>}
                    {error && <p className='text-red-600'>Error loading machines: {error.message}</p>}
                    {!isPending && !error && machines.length === 0 && (
                        <p className='text-muted-foreground'>No machines yet — add one above.</p>
                    )}
                    {machines.map((m) => (
                        <button
                            key={m.id}
                            onClick={() => goToMachine(m.id)}
                            className='flex w-full items-center justify-between rounded-md border px-4 py-3 text-left hover:bg-secondary'
                        >
                            <div>
                                <div className='flex items-center gap-2 font-medium'>
                                    {m.machineId}
                                    {m.isDemo && <Badge variant='outline' className='text-xs font-normal'>Demo</Badge>}
                                </div>
                                <div className='text-xs text-muted-foreground'>{m.machineType}{m.location ? ` · ${m.location}` : ''}</div>
                            </div>
                            <Badge className={CRITICALITY_STYLES[m.criticality] ?? CRITICALITY_STYLES.medium}>{m.criticality}</Badge>
                        </button>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}

export function LiveMonitoringView() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const machineProfileId = searchParams.get('machineProfileId') ?? '';
    const { data, isPending, error, dataUpdatedAt } = useTelemetry(machineProfileId || undefined);

    if (!machineProfileId) {
        return <MachinePicker />;
    }

    if (isPending) {
        return <p className='text-muted-foreground'>Loading live telemetry…</p>;
    }

    if (error) {
        return <p className='text-red-600'>Error loading telemetry: {error.message}</p>;
    }

    if (!data) {
        return null;
    }

    const chartData = data.readings.map((r) => ({
        time: new Date(r.recordedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
        value: r.value,
    }));

    const latest = data.readings.at(-1);

    return (
        <div className='space-y-6'>
            <Alert>
                <IconActivity className='h-4 w-4' />
                <AlertTitle>Simulated telemetry</AlertTitle>
                <AlertDescription>
                    Readings are demo data re-baselined from a live public feed — there is no real sensor on this machine.
                    See the project README for why. Refreshes automatically every 30s.
                </AlertDescription>
            </Alert>

            <Card>
                <CardHeader>
                    <CardTitle className='flex items-center justify-between'>
                        <span>Machine Health</span>
                        <Badge className={STATUS_STYLES[data.status]}>{data.status}</Badge>
                    </CardTitle>
                    <CardDescription>
                        Current: {latest?.value ?? '—'}{data.unit} · Baseline: ~{data.baseline}{data.unit}
                        {dataUpdatedAt ? ` · Updated ${new Date(dataUpdatedAt).toLocaleTimeString('de-DE')}` : ''}
                    </CardDescription>
                </CardHeader>
                <CardContent className='px-2 pt-4 sm:px-6 sm:pt-6'>
                    <ChartContainer config={chartConfig} className='aspect-auto h-[250px] w-full'>
                        <LineChart data={chartData} margin={{ left: 12, right: 12 }}>
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey='time' tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} />
                            <YAxis tickLine={false} axisLine={false} tickMargin={8} width={40} />
                            <ReferenceLine y={data.baseline} stroke='var(--muted-foreground)' strokeDasharray='4 4' />
                            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator='dot' />} />
                            <Line dataKey='value' type='monotone' stroke='var(--color-value)' strokeWidth={2} dot={false} />
                        </LineChart>
                    </ChartContainer>
                </CardContent>
            </Card>

            {data.suggestedIssues.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className='flex items-center gap-2'>
                            <IconAlertTriangle className='h-4 w-4 text-yellow-600' />
                            Suggested Issues
                        </CardTitle>
                        <CardDescription>
                            Detected from live readings and already saved to this machine&apos;s profile.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className='space-y-2'>
                        {data.suggestedIssues.map((issue, i) => (
                            <div key={i} className='rounded-md bg-secondary px-3 py-2 text-sm'>{issue}</div>
                        ))}
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Ready to act on this?</CardTitle>
                    <CardDescription>
                        Find matching measures for this machine — any live-detected issues above are already part of its profile.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={() => router.push(`/dashboard/maintenance/measures?machineProfileId=${machineProfileId}`)}>
                        Find Measures &amp; Generate Plan
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
