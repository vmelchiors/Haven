import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'icon' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, disabled, children, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-haven-accent/60 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none select-none cursor-pointer tracking-tight';

    const variants = {
      primary:
        'bg-haven-accent hover:bg-haven-accent-hover active:bg-haven-accent-active text-white shadow-subtle border border-indigo-400/20 active:scale-[0.99]',
      secondary:
        'bg-haven-surface hover:bg-haven-surface-hover active:bg-haven-dark text-zinc-200 hover:text-white border border-haven-border active:scale-[0.99]',
      outline:
        'bg-transparent hover:bg-haven-surface text-zinc-300 hover:text-white border border-haven-border hover:border-haven-muted/40 active:scale-[0.99]',
      danger:
        'bg-haven-rose hover:bg-red-600 active:bg-red-700 text-white shadow-subtle border border-red-400/20 active:scale-[0.99]',
      ghost:
        'bg-transparent hover:bg-haven-surface/70 text-zinc-400 hover:text-zinc-100 active:bg-haven-surface',
      icon:
        'bg-transparent hover:bg-haven-surface text-zinc-400 hover:text-zinc-100 rounded-lg p-2 transition-colors',
    };

    const sizes = {
      sm: 'text-xs px-2.5 py-1.5 gap-1.5 h-8',
      md: 'text-xs px-3.5 py-2 gap-2 h-9',
      lg: 'text-sm px-4 py-2.5 gap-2.5 h-10',
      icon: 'p-2 w-9 h-9',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={twMerge(clsx(baseStyles, variants[variant], sizes[size], className))}
        {...props}
      >
        {isLoading ? (
          <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5" />
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
