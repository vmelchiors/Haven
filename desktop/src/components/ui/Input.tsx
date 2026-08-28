import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-[11px] font-medium tracking-wide text-zinc-400 uppercase">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={twMerge(
            clsx(
              'w-full bg-haven-darker border border-haven-border rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-haven-accent focus:ring-1 focus:ring-haven-accent/50 transition-colors duration-150',
              error && 'border-haven-rose focus:border-haven-rose focus:ring-haven-rose/50 text-red-100',
              className
            )
          )}
          {...props}
        />
        {error && <span className="text-[11px] text-haven-rose font-medium">{error}</span>}
        {helperText && !error && <span className="text-[11px] text-zinc-500">{helperText}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';
