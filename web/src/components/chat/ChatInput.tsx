import React, { useState, useRef, useCallback } from 'react';
import { Send, Smile, Paperclip } from 'lucide-react';

interface ChatInputProps {
  channelName: string;
  onSendMessage: (content: string) => void;
  onTyping: (isTyping: boolean) => void;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  channelName,
  onSendMessage,
  onTyping,
  disabled = false,
}) => {
  const [content, setContent] = useState('');
  const typingTimerRef = useRef<number | null>(null);

  const handleTyping = useCallback(() => {
    onTyping(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(() => {
      onTyping(false);
    }, 2000);
  }, [onTyping]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || disabled) return;

    onSendMessage(trimmed);
    setContent('');
    onTyping(false);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="px-4 pb-4 pt-1 flex-shrink-0">
      <form
        onSubmit={handleSubmit}
        className="flex items-center bg-haven-card border border-haven-border focus-within:border-haven-accent/60 focus-within:ring-1 focus-within:ring-haven-accent/30 rounded-xl px-2.5 py-1 transition-colors duration-150"
      >
        <button
          type="button"
          className="text-zinc-500 hover:text-zinc-300 p-1.5 rounded-md hover:bg-haven-surface transition-colors cursor-pointer"
          title="Anexo"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        <textarea
          rows={1}
          value={content}
          disabled={disabled}
          onChange={(e) => {
            setContent(e.target.value);
            handleTyping();
          }}
          onKeyDown={handleKeyDown}
          placeholder={`Enviar mensagem em #${channelName}...`}
          className="flex-1 bg-transparent border-none focus:outline-none text-xs text-zinc-100 placeholder-zinc-500 px-2.5 py-1.5 resize-none max-h-32 scrollbar-none font-normal"
        />

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="text-zinc-500 hover:text-zinc-300 p-1.5 rounded-md hover:bg-haven-surface transition-colors cursor-pointer"
            title="Emojis"
          >
            <Smile className="w-4 h-4" />
          </button>
          <button
            type="submit"
            disabled={!content.trim() || disabled}
            className="bg-haven-accent hover:bg-haven-accent-hover active:bg-haven-accent-active text-white p-1.5 rounded-lg disabled:opacity-30 transition-all duration-150 cursor-pointer disabled:cursor-not-allowed"
            title="Enviar"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
};
