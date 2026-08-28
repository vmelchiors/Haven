import React, { useEffect } from 'react';
import { Hash, Users, Shield } from 'lucide-react';
import { Channel, Message } from '../../types';
import { useChatStore } from '../../stores/chatStore';
import { useWebSocket } from '../../hooks/useWebSocket';
import { VirtualizedMessageList } from './VirtualizedMessageList';
import { TypingIndicator } from './TypingIndicator';
import { ChatInput } from './ChatInput';

interface ChatAreaProps {
  channel: Channel;
}

const EMPTY_MESSAGES: Message[] = [];
const EMPTY_TYPING: Record<string, string> = {};

export const ChatArea: React.FC<ChatAreaProps> = ({ channel }) => {
  const channelId = channel?.id;

  // Stable selectors - Never return a new [] or {} literal in selector!
  const channelMessages = useChatStore((s) => (channelId ? s.messages[channelId] : undefined));
  const channelTyping = useChatStore((s) => (channelId ? s.typingUsers[channelId] : undefined));
  const hasMore = useChatStore((s) => (channelId ? s.hasMore[channelId] : false));
  const isLoadingMessages = useChatStore((s) => s.isLoadingMessages);

  const messages = channelMessages || EMPTY_MESSAGES;
  const typingUsers = channelTyping || EMPTY_TYPING;

  const { sendChatMessage, sendTypingIndicator } = useWebSocket();

  useEffect(() => {
    if (channelId) {
      useChatStore.getState().fetchMessages(channelId);
    }
  }, [channelId]);

  const handleSendMessage = (content: string) => {
    if (channelId) {
      sendChatMessage(channelId, content);
    }
  };

  const handleTyping = (isTyping: boolean) => {
    if (channelId) {
      sendTypingIndicator(channelId, isTyping);
    }
  };

  const handleLoadMore = (beforeId: string) => {
    if (channelId) {
      useChatStore.getState().fetchMessages(channelId, beforeId);
    }
  };

  if (!channel) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-zinc-500 text-xs">
        Selecione um canal para começar
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-haven-darker overflow-hidden">
      {/* Channel Header */}
      <div className="h-12 px-4 border-b border-haven-border flex items-center justify-between flex-shrink-0 bg-haven-darker/90 backdrop-blur-md">
        <div className="flex items-center gap-2 min-w-0">
          <Hash className="w-4 h-4 text-zinc-400 flex-shrink-0" />
          <h2 className="font-semibold text-xs text-zinc-100 tracking-tight truncate">{channel.name}</h2>
          <span className="text-[11px] text-zinc-500 hidden md:inline ml-1 border-l border-haven-border pl-2 truncate font-normal">
            Canal de texto
          </span>
        </div>

        <div className="flex items-center gap-3 text-zinc-400">
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 bg-haven-card px-2 py-0.5 rounded-md border border-haven-border">
            <Shield className="w-3 h-3 text-haven-emerald" />
            <span className="font-medium">Zero-PII</span>
          </div>
          <button className="hover:text-zinc-200 transition-colors cursor-pointer" title="Membros">
            <Users className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Virtualized Message List */}
      <VirtualizedMessageList
        messages={messages}
        hasMore={hasMore}
        isLoadingMore={isLoadingMessages}
        onLoadMore={handleLoadMore}
      />

      {/* Typing Indicator */}
      <TypingIndicator typingUsers={typingUsers} />

      {/* Chat Input */}
      <ChatInput
        channelName={channel.name}
        onSendMessage={handleSendMessage}
        onTyping={handleTyping}
      />
    </div>
  );
};
