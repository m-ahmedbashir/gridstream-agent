'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, UIToolInvocation } from 'ai';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { IconSend, IconRobot, IconUser, IconSparkles, IconX } from '@tabler/icons-react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts?: Array<{ type?: string; text?: string; toolInvocation?: UIToolInvocation<any> }>;
  content?: string;
};

type ChatRow =
  | { id: string; kind: 'message'; message: ChatMessage }
  | { id: 'loading'; kind: 'loading' };

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
  const { messages, sendMessage, status, error, stop } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  });
  const [input, setInput] = useState('');
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  const suggestions = [
    'What triggers a fault diagnosis?',
    'What do the severity levels mean?',
    'Why does every alert need approval?'
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
  const showLoadingBubble = isLoading && messages[messages.length - 1]?.role === 'user';
  const rows: ChatRow[] = messages.map((message) => ({
    id: message.id,
    kind: 'message',
    message: message as ChatMessage,
  }));

  if (showLoadingBubble) {
    rows.push({ id: 'loading', kind: 'loading' });
  }

  useEffect(() => {
    if (rows.length === 0) return;
    if (status !== 'streaming' && status !== 'submitted') return;

    requestAnimationFrame(() => {
      virtuosoRef.current?.scrollToIndex({
        index: rows.length - 1,
        align: 'end',
        behavior: 'auto',
      });
    });
  }, [messages, rows.length, status]);

  return (
    <div className='flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-b-xl border-x border-b bg-background/50 shadow-sm'>
      <div className='flex items-center justify-between p-4 border-b bg-card min-h-[64px]'>
        <div className='flex items-center gap-3'>
          <div className='p-2 bg-primary/10 rounded-xl text-primary'>
            <IconSparkles className='w-5 h-5' />
          </div>
          <div>
            <h2 className='text-lg font-semibold tracking-tight'>My Assistant</h2>
            <p className='text-xs text-muted-foreground'>Powered by secure AI</p>
          </div>
        </div>
      </div>
      
      <div className='min-h-0 flex-1'>
        {messages.length === 0 ? (
          <div className='flex h-full items-center justify-center p-6'>
            <div className='flex flex-col items-center justify-center text-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500'>
              <div className='mb-2 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-primary/60 shadow-lg'>
                <IconRobot className='h-10 w-10 text-primary-foreground' />
              </div>
              <div className='space-y-2'>
                <h3 className='text-3xl font-bold tracking-tight'>Welcome to My Assistant</h3>
                <p className='text-muted-foreground max-w-md px-4'>
                  Get quick help from your assistant anytime.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <Virtuoso
            ref={virtuosoRef}
            className='h-full'
            data={rows}
            computeItemKey={(_, row) => row.id}
            alignToBottom
            atBottomThreshold={80}
            followOutput={(isAtBottom) => {
              if (status === 'streaming') return 'auto';
              if (status === 'submitted') return 'smooth';
              return isAtBottom ? 'smooth' : false;
            }}
            increaseViewportBy={{ top: 200, bottom: 500 }}
            components={{
              List: ({ style, children, ...props }) => (
                <div {...props} style={style} className='mx-auto w-full max-w-4xl px-6 pb-4 pt-6'>
                  {children}
                </div>
              ),
            }}
            itemContent={(_, row) => {
              if (row.kind === 'loading') {
                return (
                  <div className='py-3'>
                    <div className='flex items-end gap-3'>
                      <div className='mb-1 shrink-0 rounded-full bg-card border p-2 text-muted-foreground shadow-sm'>
                        <IconRobot className='h-5 w-5' />
                      </div>
                      <div className='flex w-16 items-center gap-1 rounded-3xl rounded-bl-sm border bg-card px-5 py-4 shadow-sm'>
                        <div className='h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40' style={{ animationDelay: '0ms' }} />
                        <div className='h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40' style={{ animationDelay: '150ms' }} />
                        <div className='h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40' style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                );
              }

              const message = row.message;
              const messageText = extractMessageText(message);
              const showToolPlaceholder = message.role === 'assistant' && !messageText;

              return (
                <div className='py-3'>
                  <div className={`group flex items-end gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`mb-1 shrink-0 rounded-full p-2 shadow-sm transition-transform duration-300 group-hover:scale-105 ${message.role === 'user' ? 'bg-primary/10 text-primary' : 'bg-card border text-foreground'}`}>
                      {message.role === 'user' ? <IconUser className='h-5 w-5' /> : <IconRobot className='h-5 w-5' />}
                    </div>
                    <div className={`flex max-w-[85%] flex-col gap-1 ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div
                        className={`whitespace-pre-wrap rounded-3xl px-5 py-3.5 text-[15px] leading-relaxed shadow-sm ${
                          message.role === 'user'
                            ? 'rounded-br-sm bg-gradient-to-br from-primary to-primary/90 text-primary-foreground'
                            : 'rounded-bl-sm border bg-card backdrop-blur-md'
                        }`}
                      >
                        {messageText ? (
                          messageText
                        ) : showToolPlaceholder ? (
                          <span className='flex items-center gap-2 italic opacity-50'>
                            <IconRobot className='h-4 w-4 animate-pulse' /> Using internal tools...
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }}
          />
        )}
      </div>
      
      <div className='p-4 pt-2 bg-gradient-to-t from-background via-background to-transparent'>
        <div className='max-w-4xl mx-auto'>
          {error && (
            <div className='mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive'>
              Chat request failed: {error.message}
            </div>
          )}
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
              placeholder='Message My Assistant...' 
              className='flex-1 h-14 rounded-full pl-6 pr-14 bg-card border-input focus-visible:ring-1 focus-visible:ring-primary shadow-lg text-[15px]'
              disabled={false}
            />
            <Button 
               type={isLoading ? 'button' : 'submit'} 
               suppressHydrationWarning
               disabled={!isLoading && !input?.trim()} 
               onClick={isLoading ? stop : undefined}
               size="icon" 
               className="shrink-0 h-11 w-11 rounded-full absolute right-1.5 transition-all duration-300"
               variant={isLoading ? 'destructive' : 'default'}
            >
              {isLoading ? <IconX className='w-[18px] h-[18px]' /> : <IconSend className='w-[18px] h-[18px]' />}
            </Button>
          </form>
           <div className='text-center mt-3 text-xs text-muted-foreground'>
            My Assistant can make mistakes. Consider verifying important information.
          </div>
        </div>
      </div>
    </div>
  );
}
