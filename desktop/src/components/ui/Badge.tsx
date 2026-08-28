import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'sm',
  className,
}) => {
  const variants = {
    primary: 'bg-haven-accent/20 text-indigo-300 border-haven-accent/40',
    success: 'bg-haven-emerald/20 text-emerald-300 border-haven-emerald/40',
    warning: 'bg-haven-amber/20 text-amber-300 border-haven-amber/40',
    danger: 'bg-haven-rose/20 text-rose-300 border-haven-rose/40',
    neutral: 'bg-haven-surface text-slate-300 border-haven-border',
  };

  const sizes = {
    sm: 'text-[10px] px-2 py-0.5 font-semibold tracking-wider uppercase',
    md: 'text-xs px-2.5 py-1 font-medium',
  };

  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center rounded-full border',
          variants[variant],
          sizes[size],
          className
        )
      )}
    >
      {children}
    </span>
  );
};
