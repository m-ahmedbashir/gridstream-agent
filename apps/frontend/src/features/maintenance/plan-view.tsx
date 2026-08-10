'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { approvePlan, rejectPlan } from './use-plan';
import { toast } from 'sonner';
import type { ProjectPlan, PlannedMeasure } from '@maintain/shared';

function StatusBadge({ status }: { status: string }) {
    const variants: Record<string, string> = {
        draft: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400',
        approved: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
        rejected: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
    };
    return <Badge className={variants[status] ?? variants.draft}>{status}</Badge>;
}

function currency(n: number) {
    return `€${n.toLocaleString('de-DE')}`;
}

function Timeline({ measures }: { measures: PlannedMeasure[] }) {
    return (
        <div className='space-y-6'>
            {measures.map((measure) => (
                <div key={measure.measureId} className='border-l-2 pl-4 space-y-2'>
                    <h4 className='font-semibold'>{measure.titleDe}</h4>
                    <p className='text-sm text-muted-foreground'>
                        {currency(measure.investment)} investment · {currency(measure.annualSavings)}/year savings · {measure.paybackMonths} months payback
                    </p>
                    <div className='space-y-2'>
                        {measure.tasks.map((task, idx) => (
                            <div key={idx} className='rounded-md border p-3 text-sm'>
                                <div className='font-medium'>{task.phase} ({task.durationDays} days)</div>
                                <div className='text-muted-foreground'>{task.responsibleRole}</div>
                                <div className='mt-1'>{task.description}</div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

export function PlanView() {
    const searchParams = useSearchParams();
    const planId = searchParams.get('planId') ?? '';
    const { userId } = useAuth();
    const [plan, setPlan] = useState<ProjectPlan | null>(null);
    const [loading, setLoading] = useState(true);

    // In a real app this would fetch the persisted plan. For this demo we render
    // whatever was passed in component state via the router, which Next.js does not
    // preserve. A full implementation would add a GET /maintenance/plans/:id endpoint.
    // Here we show a placeholder prompting the user to view history.

    const handleApprove = async () => {
        if (!planId) return;
        try {
            await approvePlan(planId, userId || 'default-user');
            toast.success('Plan approved');
            setPlan((prev) => prev ? { ...prev, status: 'approved' } : prev);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to approve plan');
        }
    };

    const handleReject = async () => {
        if (!planId) return;
        try {
            await rejectPlan(planId, userId || 'default-user');
            toast.success('Plan rejected');
            setPlan((prev) => prev ? { ...prev, status: 'rejected' } : prev);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to reject plan');
        }
    };

    if (!planId) {
        return (
            <Card>
                <CardContent className='p-6'>
                    <p className='text-muted-foreground'>No plan selected. Generate a plan from the measures page.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className='space-y-6'>
            <Card>
                <CardHeader>
                    <CardTitle className='flex items-center justify-between'>
                        <span>Project Plan</span>
                        <StatusBadge status={plan?.status ?? 'draft'} />
                    </CardTitle>
                    <CardDescription>
                        Plan ID: {planId}
                    </CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                    <div className='grid grid-cols-3 gap-4'>
                        <Card>
                            <CardContent className='p-4'>
                                <p className='text-sm text-muted-foreground'>Total Investment</p>
                                <p className='text-2xl font-bold'>{currency(plan?.totalInvestment ?? 0)}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className='p-4'>
                                <p className='text-sm text-muted-foreground'>Annual Savings</p>
                                <p className='text-2xl font-bold'>{currency(plan?.totalAnnualSavings ?? 0)}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className='p-4'>
                                <p className='text-sm text-muted-foreground'>Payback</p>
                                <p className='text-2xl font-bold'>{plan?.paybackMonths ?? 0} months</p>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className='bg-muted/40'>
                        <CardHeader>
                            <CardTitle className='text-base'>Executive Summary</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className='text-sm leading-relaxed'>{plan?.executiveSummary ?? 'Not available.'}</p>
                        </CardContent>
                    </Card>

                    {plan?.status === 'draft' && (
                        <div className='flex items-center justify-end gap-2'>
                            <Button variant='outline' onClick={handleReject}>Reject</Button>
                            <Button onClick={handleApprove}>Approve Plan</Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Measures Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                    {plan?.measures ? <Timeline measures={plan.measures} /> : <p className='text-muted-foreground'>No measures to display.</p>}
                </CardContent>
            </Card>
        </div>
    );
}
