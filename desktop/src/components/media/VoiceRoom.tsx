import React from 'react';
import { AlertTriangle, AudioLines, Loader2, LockKeyhole, Radio, Users } from 'lucide-react';
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
  const participantCount = useMediaStore(
    (s) => s.voiceChannelMembers[channel.id]?.length || Object.keys(s.participants).length,
  );

  const stateLabel = {
    disconnected: 'Desconectado',
    connecting: 'Conectando…',
    connected: 'Conectado',
    reconnecting: 'Reconectando…',
    error: 'Falha na conexão',
  }[connectionState];

  const stateIcon = connectionState === 'error'
    ? <AlertTriangle className="w-3 h-3" />
    : connectionState === 'connecting' || connectionState === 'reconnecting'
    ? <Loader2 className="w-3 h-3 animate-spin" />
    : <Radio className="w-3 h-3" />;

  return (
    <div className="flex-1 flex flex-col h-full bg-haven-darkest overflow-hidden relative">
      <header className="h-14 px-4 border-b border-haven-border flex items-center justify-between flex-shrink-0 bg-haven-darker/92 backdrop-blur-xl z-20">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-emerald-950/70 border border-emerald-800/50 flex items-center justify-center flex-shrink-0">
            <AudioLines className="w-4 h-4 text-haven-emerald" />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-sm text-zinc-100 tracking-tight truncate">{channel.name}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`flex items-center gap-1 text-[10px] font-medium ${
                connectionState === 'error'
                  ? 'text-haven-rose'
                  : isVoiceConnected
                  ? 'text-haven-emerald'
                  : connectionState === 'disconnected'
                  ? 'text-zinc-500'
                  : 'text-haven-amber'
              }`}>
                {stateIcon}
                {stateLabel}
              </span>
              <span className="text-zinc-700">•</span>
              <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                <Users className="w-3 h-3" />
                {participantCount} {participantCount === 1 ? 'pessoa' : 'pessoas'}
              </span>
            </div>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-zinc-400 bg-haven-card/80 px-2.5 py-1.5 rounded-lg border border-haven-border">
          <LockKeyhole className="w-3 h-3 text-haven-emerald" />
          <span>Chamada protegida</span>
        </div>
      </header>

      {(connectionState === 'reconnecting' || connectionState === 'error') && (
        <div
          role={connectionState === 'error' ? 'alert' : 'status'}
          className={`px-4 py-2 text-xs flex items-center justify-center gap-2 haven-notice-enter ${
            connectionState === 'error'
              ? 'bg-rose-950/70 text-rose-200'
              : 'bg-amber-950/60 text-amber-200'
          }`}
        >
          {connectionState === 'error'
            ? <AlertTriangle className="w-3.5 h-3.5" />
            : <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {connectionState === 'error'
            ? 'Não foi possível conectar à mídia. Saia da sala e tente novamente.'
            : 'Conexão instável. Tentando reconectar automaticamente…'}
        </div>
      )}

      <VideoGrid />
      <ControlBar />
    </div>
  );
};
