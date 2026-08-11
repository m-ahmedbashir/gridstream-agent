import { ChatView } from './chat-view';

export default function ChatPage() {
  return (
    <div className='flex h-[calc(100dvh-52px)] min-h-0 flex-1 overflow-hidden bg-background'>
      <ChatView />
    </div>
  );
}
