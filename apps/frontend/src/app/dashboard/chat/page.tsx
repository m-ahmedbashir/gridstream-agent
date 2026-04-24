import { ChatView } from './chat-view';

export default function ChatPage() {
  return (
    <div className='flex-1 h-[calc(100vh-4rem)] md:h-full bg-background'>
      <ChatView />
    </div>
  );
}
