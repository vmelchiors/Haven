import React, { useState } from 'react';
import { Headphones, Loader2, Radio, Volume2 } from 'lucide-react';
import { Channel } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import { useMediaStore } from '../../stores/mediaStore';

interface VoiceChannelPreviewProps { channel: Channel }

export const VoiceChannelPreview: React.FC<VoiceChannelPreviewProps> = ({ channel }) => {
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connectVoice = useMediaStore((s) => s.connectVoice);

  const join = async () => {
    const tokens = useAuthStore.getState().tokens;
    if (!tokens || isJoining) return;
    setIsJoining(true);
    setError(null);
    try {
      const response = await fetch(`/api/channels/${channel.id}/rtc-token`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (!response.ok) throw new Error('Não foi possível acessar este canal de voz.');
      const rtc = await response.json();
      connectVoice(channel, rtc.token, rtc.url, rtc.room_name);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao entrar no canal.');
      setIsJoining(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-haven-darkest">
      <header className="h-12 px-5 border-b border-haven-border flex items-center gap-2 bg-haven-darker/90">
        <Volume2 className="w-4 h-4 text-zinc-400" />
        <span className="text-sm font-semibold text-zinc-100 truncate">{channel.name}</span>
        <span className="ml-2 text-[10px] text-zinc-500 px-2 py-0.5 rounded-full bg-haven-card border border-haven-border">Desconectado</span>
      </header>
      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-md text-center rounded-2xl border border-haven-border bg-haven-card/70 px-8 py-10 shadow-popover animate-scale-up">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-haven-accent/15 border border-haven-accent/25 flex items-center justify-center mb-5">
            <Headphones className="w-7 h-7 text-indigo-300" />
          </div>
          <h2 className="text-lg font-semibold text-zinc-100">Entrar em {channel.name}</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">Conecte-se para conversar, ligar a câmera ou compartilhar sua tela.</p>
          <button
            onClick={join}
            disabled={isJoining}
            className="mt-6 min-w-44 inline-flex items-center justify-center gap-2 rounded-lg bg-haven-accent hover:bg-haven-accent-hover disabled:opacity-60 px-5 py-2.5 text-sm font-semibold text-white transition-all cursor-pointer disabled:cursor-wait"
          >
            {isJoining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
            {isJoining ? 'Entrando…' : 'Entrar no canal'}
          </button>
          {error && <div className="mt-4 px-3 py-2 rounded-lg border border-rose-800/50 bg-rose-950/40 text-xs text-rose-200 animate-fadeIn">{error}</div>}
        </div>
      </div>
    </div>
  );
};
