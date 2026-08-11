'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { IconRobot } from '@tabler/icons-react';

export default function FloatingAssistantButton() {
  const pathname = usePathname();
  const isChatRoute = pathname?.startsWith('/dashboard/chat');

  if (isChatRoute) {
    return null;
  }

  return (
    <div className='fixed bottom-6 right-6 z-50'>
      <Button
        asChild
        size='icon'
        className='h-12 w-12 rounded-full shadow-lg'
        aria-label='Open My Assistant'
      >
        <Link href='/dashboard/chat'>
          <IconRobot className='h-5 w-5' />
        </Link>
      </Button>
    </div>
  );
}
