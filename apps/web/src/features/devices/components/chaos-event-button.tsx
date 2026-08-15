'use client';

import { toast } from 'sonner';
import { IconBolt } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { useSimulateChaosEventMutation } from '../hooks/use-devices';

/**
 * Demo control: enqueues a real threshold-breaching reading for a random
 * device through the actual Redis/BullMQ queue, so the whole ingestion →
 * diagnosis → Active Alerts loop can be shown on demand instead of waiting
 * on the automatic simulator's 1-in-10 chance per tick.
 */
export function ChaosEventButton() {
  const mutation = useSimulateChaosEventMutation();

  const onClick = () => {
    mutation.mutate(undefined, {
      onSuccess: (result) => {
        toast.success(`Chaos event triggered on ${result.serialNumber}`, {
          description: 'The diagnostic agent is investigating — check Active Alerts in a few seconds.',
        });
      },
      onError: (error) => {
        toast.error(error instanceof ApiError ? error.message : 'Failed to trigger chaos event');
      },
    });
  };

  return (
    <Button variant='outline' onClick={onClick} disabled={mutation.isPending}>
      <IconBolt className='mr-2 h-4 w-4' />
      {mutation.isPending ? 'Triggering…' : 'Simulate Chaos Event'}
    </Button>
  );
}
