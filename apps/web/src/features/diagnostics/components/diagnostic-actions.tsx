'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { IconCheck, IconX } from '@tabler/icons-react';
import { AlertModal } from '@/components/modal/alert-modal';
import { Button } from '@/components/ui/button';
import type { FaultDiagnosticWithDevice } from '@gridstream/shared';
import { useApproveDiagnosticMutation, useRejectDiagnosticMutation } from '../hooks/use-diagnostics';

export function DiagnosticActions({ diagnostic }: { diagnostic: FaultDiagnosticWithDevice }) {
  const [pendingAction, setPendingAction] = useState<'approve' | 'reject' | null>(null);
  const approveMutation = useApproveDiagnosticMutation();
  const rejectMutation = useRejectDiagnosticMutation();

  if (diagnostic.status !== 'PENDING_APPROVAL') {
    return (
      <span className='text-muted-foreground text-xs'>
        {diagnostic.status === 'APPROVED' ? 'Approved' : 'Rejected'}
      </span>
    );
  }

  const loading = approveMutation.isPending || rejectMutation.isPending;

  const onConfirm = async () => {
    const action = pendingAction;
    try {
      if (action === 'approve') {
        await approveMutation.mutateAsync(diagnostic.id);
        toast.success('Diagnosis approved');
      } else if (action === 'reject') {
        await rejectMutation.mutateAsync(diagnostic.id);
        toast.success('Diagnosis rejected');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <>
      <AlertModal
        isOpen={pendingAction !== null}
        onClose={() => setPendingAction(null)}
        onConfirm={onConfirm}
        loading={loading}
      />
      <div className='flex gap-2'>
        <Button size='sm' variant='outline' onClick={() => setPendingAction('approve')} disabled={loading}>
          <IconCheck className='mr-1 h-4 w-4' /> Approve
        </Button>
        <Button size='sm' variant='destructive' onClick={() => setPendingAction('reject')} disabled={loading}>
          <IconX className='mr-1 h-4 w-4' /> Reject
        </Button>
      </div>
    </>
  );
}
