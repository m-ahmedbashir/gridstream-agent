'use client';

import { useChat } from '@ai-sdk/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { IconSend, IconRobot, IconUser } from '@tabler/icons-react';
import { useEffect, useRef } from 'react';

export function ChatView() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
    maxSteps: 3, // Enable automatic tool usage
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <Card className='flex flex-col h-[70vh]'>
      <CardHeader className='border-b'>
        <CardTitle className='flex items-center gap-2'>
          <IconRobot className='w-6 h-6 text-primary' />
          Invoice Assistant
        </CardTitle>
        <CardDescription>
          Try asking "What is my total spent?", "List my AWS invoices", or "Which invoices are pending?"
        </CardDescription>
      </CardHeader>
      
      <ScrollArea className='flex-1 p-6' ref={scrollRef}>
        <div className='space-y-6'>
          {messages.length === 0 && (
            <div className='text-center text-muted-foreground pt-10'>
              No messages yet. Send a message to start!
            </div>
          )}
          {messages.map(m => (
            <div 
              key={m.id} 
              className={`flex items-start gap-4 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`p-2 rounded-full shrink-0 ${m.role === 'user' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                {m.role === 'user' ? <IconUser className='w-5 h-5' /> : <IconRobot className='w-5 h-5' />}
              </div>
              <div className={`flex flex-col gap-1 max-w-[80%] ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div 
                  className={`p-3 rounded-xl whitespace-pre-wrap ${
                    m.role === 'user' 
                      ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                      : 'bg-muted text-foreground rounded-tl-sm'
                  }`}
                >
                  {m.content?.trim() ? m.content : <span className="italic opacity-50">Using internal tools...</span>}
                </div>
              </div>
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role === 'user' && (
            <div className='flex items-start gap-4'>
               <div className='p-2 rounded-full bg-muted text-muted-foreground shrink-0'>
                <IconRobot className='w-5 h-5 animate-pulse' />
              </div>
              <div className='p-3 rounded-xl bg-muted animate-pulse w-24 h-10'></div>
            </div>
          )}
        </div>
      </ScrollArea>
      
      <div className='p-4 border-t'>
        <form 
          onSubmit={(e) => {
             e.preventDefault();
             if (input?.trim()) handleSubmit(e);
          }} 
          className='flex items-center gap-2'
        >
          <Input 
            value={input} 
            onChange={handleInputChange} 
            placeholder='Ask about your invoices...' 
            className='flex-1'
            disabled={isLoading}
          />
          <Button type='submit' disabled={isLoading || !input?.trim()} size="icon" className="shrink-0">
            <IconSend className='w-4 h-4' />
          </Button>
        </form>
      </div>
    </Card>
  );
}
