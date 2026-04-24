'use client';

import { useChat } from '@ai-sdk/react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { IconSend, IconRobot, IconUser, IconSparkles } from '@tabler/icons-react';
import { FormEvent, useEffect, useRef, useState } from 'react';

function extractMessageText(message: { content?: string; parts?: Array<{ type?: string; text?: string }> }) {
  if (typeof message.content === 'string' && message.content.trim().length > 0) {
    return message.content.trim();
  }

  if (!Array.isArray(message.parts)) {
    return '';
  }

  return message.parts
    .filter((part) => part?.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text?.trim() ?? '')
    .filter(Boolean)
    .join('\n')
    .trim();
}

export function ChatView() {
  const { messages, sendMessage, status } = useChat({
    api: '/api/chat',
    maxSteps: 3, // Enable automatic tool usage
  });
  const [input, setInput] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const suggestions = [
    "What is my total spent?",
    "List my AWS invoices",
    "Which invoices are pending?"
  ];

  const handleSuggestionClick = async (suggestion: string) => {
    if (!suggestion.trim()) return;
    await sendMessage({ text: suggestion });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    await sendMessage({ text: trimmed });
    setInput('');
  };

  const isLoading = status === 'submitted' || status === 'streaming';

  return (
    <div className='flex flex-col h-full bg-background/50 border-x border-b shadow-sm rounded-b-xl overflow-hidden'>
      <div className='flex items-center justify-between p-4 border-b bg-card min-h-[64px]'>
        <div className='flex items-center gap-3'>
          <div className='p-2 bg-primary/10 rounded-xl text-primary'>
            <IconSparkles className='w-5 h-5' />
          </div>
          <div>
            <h2 className='text-lg font-semibold tracking-tight'>Invoice Assistant</h2>
            <p className='text-xs text-muted-foreground'>Powered by secure AI</p>
          </div>
        </div>
      </div>
      
      <ScrollArea className='flex-1 p-6' ref={scrollRef}>
        <div className='space-y-6 max-w-4xl mx-auto pb-4'>
          {messages.length === 0 && (
            <div className='flex flex-col items-center justify-center pt-20 text-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500'>
               <div className='w-20 h-20 rounded-2xl bg-gradient-to-tr from-primary to-primary/60 shadow-lg flex items-center justify-center mb-2'>
                 <IconRobot className='w-10 h-10 text-primary-foreground' />
               </div>
               <div className='space-y-2'>
                 <h3 className='text-3xl font-bold tracking-tight'>Welcome to your AI Copilot</h3>
                 <p className='text-muted-foreground max-w-md px-4'>
                   Ask questions about your invoices. The AI has direct, secure access to your database to help you understand your spending effortlessly.
                 </p>
               </div>
            </div>
          )}
          {messages.map((m) => {
            const messageText = extractMessageText(m);
            const showToolPlaceholder = m.role === 'assistant' && !messageText;

            return (
            <div
              key={m.id}
              className={`flex items-end gap-3 group animate-in fade-in slide-in-from-bottom-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`p-2 rounded-full shrink-0 shadow-sm transition-transform duration-300 group-hover:scale-105 ${m.role === 'user' ? 'bg-primary/10 text-primary mb-1' : 'bg-card border text-foreground mb-1'}`}>
                {m.role === 'user' ? <IconUser className='w-5 h-5' /> : <IconRobot className='w-5 h-5' />}
              </div>
              <div className={`flex flex-col gap-1 max-w-[85%] ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div 
                  className={`px-5 py-3.5 rounded-3xl whitespace-pre-wrap shadow-sm text-[15px] leading-relaxed ${
                    m.role === 'user' 
                      ? 'bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-br-sm' 
                      : 'bg-card border backdrop-blur-md rounded-bl-sm'
                  }`}
                >
                  {messageText ? messageText : showToolPlaceholder ? <span className="italic opacity-50 flex items-center gap-2"><IconRobot className='w-4 h-4 animate-pulse' /> Using internal tools...</span> : null}
                </div>
              </div>
            </div>
          )})}
          {isLoading && messages[messages.length - 1]?.role === 'user' && (
            <div className='flex items-end gap-3 animate-in fade-in'>
               <div className='p-2 rounded-full bg-card border shadow-sm text-muted-foreground shrink-0 mb-1'>
                <IconRobot className='w-5 h-5' />
              </div>
              <div className='px-5 py-4 rounded-3xl bg-card border rounded-bl-sm shadow-sm flex items-center gap-1 w-16'>
                <div className='w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce' style={{ animationDelay: '0ms' }} />
                <div className='w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce' style={{ animationDelay: '150ms' }} />
                <div className='w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce' style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
      
      <div className='p-4 pt-2 bg-gradient-to-t from-background via-background to-transparent'>
        <div className='max-w-4xl mx-auto'>
          {messages.length === 0 && (
            <div className='flex flex-wrap gap-2 mb-3 justify-center'>
              {suggestions.map((suggestion, i) => (
                <button
                  key={i}
                  suppressHydrationWarning
                  onClick={() => handleSuggestionClick(suggestion)}
                  className='text-[13px] px-4 py-2 rounded-full bg-card border shadow-sm hover:border-primary/50 hover:bg-muted text-foreground transition-all duration-200 hover:shadow-md'
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
          <form 
            onSubmit={handleSubmit} 
            className='flex items-center relative'
          >
            <Input 
              value={input} 
              onChange={(event) => setInput(event.target.value)} 
              placeholder='Message your AI Copilot...' 
              className='flex-1 h-14 rounded-full pl-6 pr-14 bg-card border-input focus-visible:ring-1 focus-visible:ring-primary shadow-lg text-[15px]'
              disabled={isLoading}
            />
            <Button 
               type='submit' 
               suppressHydrationWarning
               disabled={isLoading || !input?.trim()} 
               size="icon" 
               className="shrink-0 h-11 w-11 rounded-full absolute right-1.5 transition-all duration-300"
            >
              <IconSend className='w-[18px] h-[18px]' />
            </Button>
          </form>
           <div className='text-center mt-3 text-xs text-muted-foreground'>
            AI Copilot can make mistakes. Consider verifying important information.
          </div>
        </div>
      </div>
    </div>
  );
}
