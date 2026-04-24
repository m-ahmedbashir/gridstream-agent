import { ChatView } from './chat-view';

export default function ChatPage() {
  return (
    <div className='flex-1 space-y-4 p-4 md:p-8 pt-6'>
      <div className='flex flex-col gap-2'>
        <h2 className='text-3xl font-bold tracking-tight'>AI Copilot</h2>
        <p className='text-muted-foreground'>
          Ask questions about your invoices. The AI has direct, secure access to your database.
        </p>
      </div>
      <ChatView />
    </div>
  );
}
