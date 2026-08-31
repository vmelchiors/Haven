import React, { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface AvatarProps {
  src?: string;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isSpeaking?: boolean;
  status?: 'online' | 'idle' | 'busy' | 'offline';
  className?: string;
}

const AVATAR_PALETTES = [
  'bg-indigo-950/90 text-indigo-200 border border-indigo-700/40',
  'bg-slate-800 text-slate-200 border border-slate-700/50',
  'bg-blue-950/90 text-blue-200 border border-blue-700/40',
  'bg-emerald-950/90 text-emerald-200 border border-emerald-700/40',
  'bg-amber-950/90 text-amber-200 border border-amber-700/40',
  'bg-violet-950/90 text-violet-200 border border-violet-700/40',
  'bg-cyan-950/90 text-cyan-200 border border-cyan-700/40',
  'bg-zinc-800 text-zinc-200 border border-zinc-700/50',
];

function getPaletteIndex(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % AVATAR_PALETTES.length;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 'md',
  isSpeaking = false,
  status,
  className,
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [src]);
  const sizes = {
    xs: 'w-5 h-5 text-[9px]',
    sm: 'w-7 h-7 text-xs',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm',
    xl: 'w-14 h-14 text-base',
  };

  const statusSizes = {
    xs: 'w-1.5 h-1.5 ring-1',
    sm: 'w-2 h-2 ring-2',
    md: 'w-2.5 h-2.5 ring-2',
    lg: 'w-3 h-3 ring-2',
    xl: 'w-3.5 h-3.5 ring-2',
  };

  const statusColors = {
    online: 'bg-haven-emerald ring-haven-darker',
    idle: 'bg-haven-amber ring-haven-darker',
    busy: 'bg-haven-rose ring-haven-darker',
    offline: 'bg-zinc-500 ring-haven-darker',
  };

  const getInitials = (n: string) => {
    if (!n) return '?';
    const parts = n.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const palette = AVATAR_PALETTES[getPaletteIndex(name || 'User')];

  return (
    <div className="relative inline-flex flex-shrink-0">
      <div
        className={twMerge(
          clsx(
            'relative rounded-full flex items-center justify-center font-semibold overflow-hidden transition-all duration-150',
            sizes[size],
            isSpeaking ? 'ring-2 ring-haven-emerald ring-offset-1 ring-offset-haven-dark animate-pulse-ring' : '',
            className
          )
        )}
      >
        {src && !imageFailed ? (
          <img src={src} alt={name} className="w-full h-full object-cover" onError={() => setImageFailed(true)} />
        ) : (
          <div className={twMerge(clsx('w-full h-full flex items-center justify-center font-bold tracking-tight', palette))}>
            {getInitials(name)}
          </div>
        )}
      </div>

      {status && (
        <span
          className={twMerge(
            clsx(
              'absolute bottom-0 right-0 rounded-full',
              statusSizes[size],
              statusColors[status]
            )
          )}
        />
      )}
    </div>
  );
};
