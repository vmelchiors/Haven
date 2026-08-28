import React from 'react';

interface TypingIndicatorProps {
  typingUsers: Record<string, string>; // userId -> username
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ typingUsers }) => {
  const users = Object.values(typingUsers);
  if (users.length === 0) {
    return <div className="h-4 px-4" />;
  }

  let text = '';
  if (users.length === 1) {
    text = `${users[0]} está digitando...`;
  } else if (users.length === 2) {
    text = `${users[0]} e ${users[1]} estão digitando...`;
  } else {
    text = `${users[0]}, ${users[1]} e mais ${users.length - 2} pessoas estão digitando...`;
  }

  return (
    <div className="h-4 px-4 flex items-center gap-1.5 text-[11px] text-zinc-400 font-medium">
      <div className="flex items-center gap-1">
        <span className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
        <span className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
        <span className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce" />
      </div>
      <span className="truncate">{text}</span>
    </div>
  );
};
