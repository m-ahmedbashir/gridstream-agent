'use client';

import { useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useMeasures } from './use-measures';
import { usePlan } from './use-plan';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Measure } from '@maintain/shared';

function CategoryBadge({ category }: { category: string }) {
    const variants: Record<string, string> = {
        predictive: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
        energy: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
        safety: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
        efficiency: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400',
        compliance: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400',
    };
    return <Badge className={variants[category] ?? variants.efficiency}>{category}</Badge>;
}

function currency(n: number) {
    return `€${n.toLocaleString('de-DE')}`;
}

export function MeasuresView() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const machineProfileId = searchParams.get('machineProfileId') ?? '';
    const { data, isPending, error } = useMeasures(machineProfileId || undefined);
    const { mutateAsync: generatePlan, isPending: generating } = usePlan();
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const measures = data?.measures ?? [];

    const totals = useMemo(() => {
        const selected = measures.filter((m) => selectedIds.has(m.id));
        return {
            investment: selected.reduce((sum, m) => sum + m.typicalInvestment, 0),
            savings: selected.reduce((sum, m) => sum + m.typicalAnnualSavings, 0),
        };
    }, [measures, selectedIds]);

    const toggleMeasure = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleGeneratePlan = async () => {
        if (selectedIds.size === 0) return;
        try {
            const plan = await generatePlan({ machineProfileId, measureIds: Array.from(selectedIds) });
            router.push(`/dashboard/maintenance/plan?planId=${(plan as any).planId ?? ''}`);
        } catch (err) {
            console.error(err);
        }
    };

    if (!machineProfileId) {
        return <p className='text-muted-foreground'>No machine profile selected.</p>;
    }

    if (isPending) {
        return <p className='text-muted-foreground'>Loading measures…</p>;
    }

    if (error) {
        return <p className='text-red-600'>Error loading measures: {error.message}</p>;
    }

    return (
        <div className='space-y-6'>
            <Card>
                <CardHeader>
                    <CardTitle>Selected Measures Summary</CardTitle>
                    <CardDescription>
                        {selectedIds.size} selected · Total investment {currency(totals.investment)} · Annual savings {currency(totals.savings)}
                    </CardDescription>
                </CardHeader>
                <CardContent className='flex items-center gap-2'>
                    <Button
                        onClick={handleGeneratePlan}
                        disabled={selectedIds.size === 0 || generating}
                    >
                        {generating ? 'Generating Plan…' : 'Generate Project Plan'}
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Recommended Measures</CardTitle>
                    <CardDescription>Top 5 measures ranked by fastest payback.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className='w-12'></TableHead>
                                <TableHead>Measure</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead className='text-right'>Investment</TableHead>
                                <TableHead className='text-right'>Annual Savings</TableHead>
                                <TableHead className='text-right'>Payback (months)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {measures.map((measure) => (
                                <TableRow key={measure.id}>
                                    <TableCell>
                                        <Checkbox
                                            checked={selectedIds.has(measure.id)}
                                            onCheckedChange={() => toggleMeasure(measure.id)}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <div className='font-medium'>{measure.titleDe}</div>
                                        <div className='text-xs text-muted-foreground'>{measure.description}</div>
                                    </TableCell>
                                    <TableCell><CategoryBadge category={measure.category} /></TableCell>
                                    <TableCell className='text-right'>{currency(measure.typicalInvestment)}</TableCell>
                                    <TableCell className='text-right'>{currency(measure.typicalAnnualSavings)}</TableCell>
                                    <TableCell className='text-right'>{measure.paybackMonths}</TableCell>
                                </TableRow>
                            ))}
                            {measures.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className='text-center text-muted-foreground'>
                                        No matching measures found for this machine.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
