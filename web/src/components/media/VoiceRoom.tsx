import React from 'react';
import { Volume2, ShieldCheck, Radio } from 'lucide-react';
import { Channel } from '../../types';
import { useMediaStore } from '../../stores/mediaStore';
import { VideoGrid } from './VideoGrid';
import { ControlBar } from './ControlBar';

interface VoiceRoomProps {
  channel: Channel;
}

export const VoiceRoom: React.FC<VoiceRoomProps> = ({ channel }) => {
  const isVoiceConnected = useMediaStore((s) => s.isVoiceConnected);

  return (
    <div className="flex-1 flex flex-col h-full bg-haven-darkest overflow-hidden relative">
      {/* Voice Header */}
      <div className="h-12 px-4 border-b border-haven-border flex items-center justify-between flex-shrink-0 bg-haven-darker/90 backdrop-blur-md z-10">
        <div className="flex items-center gap-2 min-w-0">
          <Volume2 className="w-4 h-4 text-haven-emerald flex-shrink-0" />
          <h2 className="font-semibold text-xs text-zinc-100 tracking-tight truncate">{channel.name}</h2>
          <div className="flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded-full bg-haven-card border border-haven-border text-haven-emerald text-[10px] font-medium">
            <Radio className="w-2.5 h-2.5 animate-pulse" />
            <span>{isVoiceConnected ? 'Voz Conectada (SRTP)' : 'Conectado'}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <div className="flex items-center gap-1 text-zinc-400 bg-haven-card px-2 py-0.5 rounded-md border border-haven-border text-[10px]">
            <ShieldCheck className="w-3 h-3 text-haven-emerald" />
            <span>HD Opus / 60 FPS</span>
          </div>
        </div>
      </div>

      {/* Dynamic Video / Audio Stage */}
      <VideoGrid />

      {/* Media Controls Bar */}
      <ControlBar />
    </div>
  );
};
