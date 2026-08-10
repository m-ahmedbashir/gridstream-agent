'use client';

import { useAuth } from '@clerk/nextjs';
import { usePlanHistory } from './use-plan-history';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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

export function PlanHistoryView() {
    const { userId } = useAuth();
    const { data, isPending, error } = usePlanHistory(userId);

    const plans = data?.plans ?? [];

    if (isPending) {
        return <p className='text-muted-foreground'>Loading plan history…</p>;
    }

    if (error) {
        return <p className='text-red-600'>Error loading plan history: {error.message}</p>;
    }

    return (
        <div className='space-y-4'>
            {plans.map((plan) => (
                <Card key={plan.id}>
                    <CardHeader>
                        <CardTitle className='flex items-center justify-between text-base'>
                            <span>
                                {plan.machineProfile?.machineType} — {plan.machineProfile?.machineId}
                            </span>
                            <StatusBadge status={plan.status} />
                        </CardTitle>
                        <CardDescription>
                            Generated {new Date(plan.generatedAt).toLocaleString('de-DE')}
                            {plan.approvedAt && ` · Approved ${new Date(plan.approvedAt).toLocaleString('de-DE')}`}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className='space-y-3'>
                        <div className='grid grid-cols-3 gap-4 text-sm'>
                            <div>
                                <p className='text-muted-foreground'>Investment</p>
                                <p className='font-medium'>{currency(plan.totalInvestment)}</p>
                            </div>
                            <div>
                                <p className='text-muted-foreground'>Annual Savings</p>
                                <p className='font-medium'>{currency(plan.totalAnnualSavings)}</p>
                            </div>
                            <div>
                                <p className='text-muted-foreground'>Payback</p>
                                <p className='font-medium'>{plan.paybackMonths} months</p>
                            </div>
                        </div>
                        <p className='text-sm text-muted-foreground line-clamp-3'>{plan.executiveSummary}</p>
                    </CardContent>
                </Card>
            ))}
            {plans.length === 0 && (
                <Card>
                    <CardContent className='p-6 text-center text-muted-foreground'>
                        No plans found. Generate a plan from the measures page.
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
