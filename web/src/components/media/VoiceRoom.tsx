import React from 'react';
import { Volume2, ShieldCheck, Radio, AlertTriangle, Loader2 } from 'lucide-react';
import { Channel } from '../../types';
import { useMediaStore } from '../../stores/mediaStore';
import { VideoGrid } from './VideoGrid';
import { ControlBar } from './ControlBar';

interface VoiceRoomProps {
  channel: Channel;
}

export const VoiceRoom: React.FC<VoiceRoomProps> = ({ channel }) => {
  const isVoiceConnected = useMediaStore((s) => s.isVoiceConnected);
  const connectionState = useMediaStore((s) => s.voiceConnectionState);

  return (
    <div className="flex-1 flex flex-col h-full bg-haven-darkest overflow-hidden relative">
      {/* Voice Header */}
      <div className="h-12 px-4 border-b border-haven-border flex items-center justify-between flex-shrink-0 bg-haven-darker/90 backdrop-blur-md z-10">
        <div className="flex items-center gap-2 min-w-0">
          <Volume2 className="w-4 h-4 text-haven-emerald flex-shrink-0" />
          <h2 className="font-semibold text-xs text-zinc-100 tracking-tight truncate">{channel.name}</h2>
          <div className="flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded-full bg-haven-card border border-haven-border text-haven-emerald text-[10px] font-medium">
            {connectionState === 'error' ? <AlertTriangle className="w-2.5 h-2.5 text-haven-rose" /> :
             isVoiceConnected ? <Radio className="w-2.5 h-2.5" /> : <Loader2 className="w-2.5 h-2.5 animate-spin" />}
            <span>{isVoiceConnected ? 'Voz conectada (SRTP)' : connectionState === 'reconnecting' ? 'Reconectando…' : connectionState === 'error' ? 'Falha na conexão' : 'Conectando…'}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <div className="flex items-center gap-1 text-zinc-400 bg-haven-card px-2 py-0.5 rounded-md border border-haven-border text-[10px]">
            <ShieldCheck className="w-3 h-3 text-haven-emerald" />
            <span>HD Opus / 60 FPS</span>
          </div>
        </div>
      </div>

      {(connectionState === 'reconnecting' || connectionState === 'error') && (
        <div className={`px-4 py-2 text-xs flex items-center justify-center gap-2 animate-fadeIn ${connectionState === 'error' ? 'bg-rose-950/70 text-rose-200' : 'bg-amber-950/70 text-amber-200'}`}>
          {connectionState === 'error' ? <AlertTriangle className="w-3.5 h-3.5" /> : <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {connectionState === 'error' ? 'Não foi possível conectar à mídia. Saia da sala e tente novamente.' : 'Conexão instável. Tentando reconectar automaticamente…'}
        </div>
      )}

      {/* Dynamic Video / Audio Stage */}
      <VideoGrid />

      {/* Media Controls Bar */}
      <ControlBar />
    </div>
  );
};
