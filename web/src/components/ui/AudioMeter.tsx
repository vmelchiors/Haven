import React from 'react';
import { clsx } from 'clsx';

interface AudioMeterProps {
  level: number; // 0.0 to 1.0
  threshold?: number;
  className?: string;
}

export const AudioMeter: React.FC<AudioMeterProps> = ({ level, threshold = 0.015, className }) => {
  // Normalize level to percentage
  const percentage = Math.min(100, Math.max(0, level * 250));
  const isAboveThreshold = level >= threshold;

  return (
    <div className={clsx('relative w-full h-2 bg-haven-darker rounded-full overflow-hidden border border-haven-border/60', className)}>
      <div
        className={clsx(
          'h-full transition-all duration-75 ease-out rounded-full',
          isAboveThreshold
            ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
            : 'bg-slate-600'
        )}
        style={{ width: `${percentage}%` }}
      />
      {threshold !== undefined && (
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10 opacity-75"
          style={{ left: `${Math.min(100, threshold * 250)}%` }}
          title="Threshold"
        />
      )}
    </div>
  );
};
