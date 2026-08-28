import React, { useRef, useEffect } from 'react';
import { Message } from '../../types';
import { MessageItem } from './MessageItem';

interface VirtualizedMessageListProps {
  messages: Message[];
  isLoadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: (beforeId: string) => void;
}

export const VirtualizedMessageList: React.FC<VirtualizedMessageListProps> = ({
  messages = [],
  isLoadingMore,
  hasMore,
  onLoadMore,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;

    // Check if scrolled near top to fetch older messages
    if (el.scrollTop < 60 && hasMore && !isLoadingMore && messages.length > 0 && messages[0]?.id) {
      onLoadMore?.(messages[0].id);
    }

    // Check if user is scrolled near bottom
    const threshold = 100;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  };

  // Scroll to bottom on new messages if user was already at the bottom
  useEffect(() => {
    if (isAtBottomRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  if (!messages || messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500">
        <div className="w-16 h-16 rounded-full bg-haven-surface/50 flex items-center justify-center mb-3">
          <span className="text-2xl">💬</span>
        </div>
        <h4 className="text-base font-semibold text-slate-300">Nenhuma mensagem ainda</h4>
        <p className="text-xs text-slate-400 mt-1">Seja o primeiro a enviar uma mensagem neste canal!</p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-haven-border hover:scrollbar-thumb-haven-muted/50 p-3 space-y-1"
    >
      {isLoadingMore && (
        <div className="py-2 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
          Carregando mensagens anteriores...
        </div>
      )}

      {messages.map((message, index) => {
        if (!message) return null;
        const prevMessage = index > 0 ? messages[index - 1] : null;
        const isCompact =
          prevMessage &&
          prevMessage.user_id === message.user_id &&
          new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime() < 300000; // 5 min

        return (
          <MessageItem
            key={message.id || index}
            message={message}
            isCompact={Boolean(isCompact)}
          />
        );
      })}
    </div>
  );
};
