import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface ModalProps {
  isOpen: boolean;
  onClose?: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
  closable?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'md',
  closable = true,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closable && onClose) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closable, onClose]);

  if (!isOpen) return null;

  const maxWidths = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Minimalist Dark Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-200"
        onClick={() => closable && onClose?.()}
      />

      {/* Content Container */}
      <div
        className={twMerge(
          clsx(
            'relative w-full bg-haven-card border border-haven-border/80 rounded-xl shadow-modal overflow-hidden z-10 animate-scale-up',
            maxWidths[maxWidth]
          )
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-haven-border/60 bg-haven-darker/60">
          <div className="pr-4">
            <h3 className="text-sm font-semibold tracking-tight text-zinc-100">{title}</h3>
            {description && <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{description}</p>}
          </div>
          {closable && onClose && (
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-100 hover:bg-haven-surface/80 rounded-lg p-1.5 transition-colors cursor-pointer"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-5 text-zinc-200">{children}</div>
      </div>
    </div>
  );
};
