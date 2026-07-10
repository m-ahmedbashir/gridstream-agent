import { Button } from '@/components/ui/button';
import { Card, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { IconTrash, IconCheck, IconX } from '@tabler/icons-react';

interface DeleteInvoiceReviewProps {
  toolCallId: string;
  invoiceId?: string;
  invoiceNumber?: string;
  vendorName?: string;
  totalAmount?: number;
  currency?: string;
  onApprove: (toolCallId: string) => void | PromiseLike<void>;
  onReject: (toolCallId: string) => void | PromiseLike<void>;
}

export function DeleteInvoiceReview({
  toolCallId,
  invoiceId,
  invoiceNumber,
  vendorName,
  totalAmount,
  currency,
  onApprove,
  onReject,
}: DeleteInvoiceReviewProps) {
  return (
    <Card className='w-full max-w-sm overflow-hidden border border-destructive/20 shadow-md animate-in fade-in zoom-in-95 duration-300'>
      <div className='bg-destructive/10 px-4 py-3 border-b border-destructive/10 flex items-center gap-2'>
        <div className='p-1.5 bg-destructive/20 rounded-full text-destructive'>
          <IconTrash className='w-4 h-4' />
        </div>
        <CardTitle className='text-sm font-semibold text-destructive'>Confirm Deletion</CardTitle>
      </div>
      <CardHeader className='py-4 space-y-1 bg-card'>
        <CardDescription className='text-xs text-muted-foreground'>
          The AI requested to delete this invoice. This action cannot be undone.
        </CardDescription>
        <div className='mt-2 rounded-lg bg-secondary/50 p-3'>
          <div className='text-sm font-medium'>Invoice {invoiceNumber || 'Unknown'}</div>
          {vendorName && <div className='text-xs text-muted-foreground'>{vendorName}</div>}
          {totalAmount !== undefined && (
            <div className='text-sm font-semibold mt-1'>
              {totalAmount} {currency || ''}
            </div>
          )}
        </div>
      </CardHeader>
      <CardFooter className='flex gap-2 p-4 pt-0 bg-card'>
        <Button 
          variant='outline' 
          className='flex-1 h-9 text-xs gap-1.5 border-muted-foreground/20 hover:bg-muted'
          onClick={() => onReject(toolCallId)}
        >
          <IconX className='w-3.5 h-3.5' /> Cancel
        </Button>
        <Button 
          variant='destructive' 
          className='flex-1 h-9 text-xs gap-1.5'
          disabled={!invoiceId && !invoiceNumber}
          onClick={() => onApprove(toolCallId)}
        >
          <IconCheck className='w-3.5 h-3.5' /> Delete
        </Button>
      </CardFooter>
    </Card>
  );
}
