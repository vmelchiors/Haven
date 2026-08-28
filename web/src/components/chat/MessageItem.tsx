import React from 'react';
import { Message } from '../../types';
import { Avatar } from '../ui/Avatar';
import { useAuthStore } from '../../stores/authStore';

interface MessageItemProps {
  message: Message;
  isCompact?: boolean;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message, isCompact = false }) => {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const isSelf = Boolean(currentUserId && message.user_id === currentUserId);

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return '';
    }
  };

  if (isSelf) {
    if (isCompact) {
      return (
        <div className="group flex items-center justify-end gap-3 px-4 py-0.5 hover:bg-haven-surface/30 transition-colors">
          <span className="text-[10px] text-zinc-500 font-mono select-none opacity-0 group-hover:opacity-100 transition-opacity">
            {formatTime(message.created_at)}
          </span>
          <div className="max-w-[80%] bg-haven-surface text-zinc-100 border border-haven-border rounded-2xl rounded-tr-sm px-3.5 py-1 text-xs leading-relaxed break-words whitespace-pre-wrap font-normal">
            {message.content}
          </div>
        </div>
      );
    }

    return (
      <div className="group flex items-start justify-end gap-3 px-4 py-1.5 hover:bg-haven-surface/30 transition-colors">
        <div className="flex flex-col items-end max-w-[80%] min-w-0">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-[10px] text-zinc-500 font-normal select-none">
              {formatDate(message.created_at)} às {formatTime(message.created_at)}
            </span>
            <span className="font-semibold text-xs text-indigo-400">
              {message.username || 'Você'}
            </span>
          </div>
          <div className="bg-haven-surface text-zinc-100 border border-haven-border rounded-2xl rounded-tr-sm px-3.5 py-1.5 text-xs leading-relaxed break-words whitespace-pre-wrap font-normal shadow-subtle">
            {message.content}
          </div>
        </div>
        <Avatar
          src={message.avatar_url}
          name={message.username || 'Você'}
          size="md"
          className="mt-0.5 flex-shrink-0"
        />
      </div>
    );
  }

  // Other users (left side)
  if (isCompact) {
    return (
      <div className="group flex items-start gap-3 px-4 py-0.5 hover:bg-haven-surface/30 transition-colors">
        <span className="text-[10px] text-zinc-500 w-9 text-right flex-shrink-0 select-none opacity-0 group-hover:opacity-100 transition-opacity font-mono">
          {formatTime(message.created_at)}
        </span>
        <div className="flex-1 text-xs text-zinc-300 leading-relaxed break-words font-normal">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-3 px-4 py-1.5 hover:bg-haven-surface/30 transition-colors">
      <Avatar
        src={message.avatar_url}
        name={message.username || 'User'}
        size="md"
        className="mt-0.5 flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-xs text-zinc-200 hover:text-white cursor-pointer hover:underline">
            {message.username || 'Anônimo'}
          </span>
          <span className="text-[10px] text-zinc-500 select-none font-normal">
            {formatDate(message.created_at)} às {formatTime(message.created_at)}
          </span>
        </div>
        <div className="text-xs text-zinc-200 mt-1 leading-relaxed break-words whitespace-pre-wrap font-normal">
          {message.content}
        </div>
      </div>
    </div>
  );
};
