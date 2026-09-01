import React, { useState } from 'react';
import { Hash, Volume2, Plus, Settings, Mic, MicOff, Headphones, VolumeX, Lock, Copy, Check, Sliders, MessageSquarePlus, Video, Monitor, PhoneOff } from 'lucide-react';
import { Channel, ChannelType } from '../../types';
import { useCommunityStore } from '../../stores/communityStore';
import { useMediaStore } from '../../stores/mediaStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAuthStore } from '../../stores/authStore';
import { useChatStore } from '../../stores/chatStore';
import { Avatar } from '../ui/Avatar';

export const ChannelSidebar: React.FC = () => {
  const selectedCommunity = useCommunityStore((s) => s.selectedCommunity);
  const selectedChannel = useCommunityStore((s) => s.selectedChannel);
  const selectChannel = useCommunityStore((s) => s.selectChannel);
  const unreadCounts = useChatStore((s) => s.unreadCounts);

  const activeVoiceChannel = useMediaStore((s) => s.activeVoiceChannel);
  const voiceConnectionState = useMediaStore((s) => s.voiceConnectionState);
  const participantTransitions = useMediaStore((s) => s.participantTransitions);
  const connectVoice = useMediaStore((s) => s.connectVoice);
  const disconnectVoice = useMediaStore((s) => s.disconnectVoice);
  const voiceChannelMembers = useMediaStore((s) => s.voiceChannelMembers);
  const isMuted = useMediaStore((s) => s.isMuted);
  const isDeafened = useMediaStore((s) => s.isDeafened);
  const toggleMute = useMediaStore((s) => s.toggleMute);
  const toggleDeafen = useMediaStore((s) => s.toggleDeafen);

  const openModal = useSettingsStore((s) => s.openModal);
  const user = useAuthStore((s) => s.user);

  const [copiedId, setCopiedId] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);

  if (!selectedCommunity) {
    return (
      <aside aria-label="Canais" className="w-60 bg-haven-dark border-r border-haven-border flex flex-col items-center justify-center p-4 text-center text-zinc-500 text-xs select-none">
        Selecione uma comunidade para navegar
      </aside>
    );
  }

  // Only the community owner or platform admins can create channels and edit community
  const isOwner = selectedCommunity.owner_id === user?.id || Boolean(user?.is_admin);

  const textChannels = selectedCommunity.channels?.filter((c) => c.type === 'TEXT') || [];
  const voiceChannels = selectedCommunity.channels?.filter((c) => c.type === 'VOICE') || [];

  const handleOpenCreateChannel = (type: ChannelType) => {
    openModal('create_channel', type);
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(selectedCommunity.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleCopyInvite = () => {
    if (!selectedCommunity.invite_code) return;
    navigator.clipboard.writeText(selectedCommunity.invite_code);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  const handleChannelClick = async (channel: Channel) => {
    selectChannel(channel);

    if (channel.type === 'VOICE') {
      // Only enter the room after obtaining valid SFU credentials.
      const tokens = useAuthStore.getState().tokens;
      if (!tokens) return;

      try {
        const res = await fetch(`/api/channels/${channel.id}/rtc-token`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });

        if (res.ok) {
          const rtcData = await res.json();
          connectVoice(channel, rtcData.token, rtcData.url, rtcData.room_name);
        } else {
          console.error('[Voice] Não foi possível obter acesso à sala:', res.status);
        }
      } catch (error) {
        console.error('[Voice] Não foi possível entrar na sala:', error);
      }
    }
  };

  return (
    <aside aria-label="Canais" className="w-60 bg-haven-dark border-r border-haven-border flex flex-col h-full flex-shrink-0 select-none">
      {/* Community Header */}
      <div className="h-12 px-4 border-b border-haven-border flex items-center justify-between font-semibold text-xs text-zinc-100 bg-haven-darker/50">
        <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-2">
          {selectedCommunity.is_private && (
            <Lock className="w-3 h-3 text-amber-400 flex-shrink-0" />
          )}
          <span className="truncate font-semibold tracking-tight text-zinc-100">{selectedCommunity.name}</span>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {isOwner && (
            <button
              onClick={() => openModal('edit_community')}
              className="p-1 rounded hover:bg-haven-surface text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              title="Configurações da Comunidade"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Community Quick Access ID & Invite Bar */}
      <div className="mx-2.5 mt-2.5 p-2 bg-haven-card border border-haven-border rounded-lg flex flex-col gap-1.5 text-xs">
        <div className="flex items-center justify-between">
          <div className="min-w-0 pr-1">
            <div className="text-[9px] text-zinc-400 font-semibold uppercase tracking-wider">ID da Comunidade</div>
            <div className="font-mono text-zinc-300 text-[11px] truncate font-medium">{selectedCommunity.id.slice(0, 8)}...</div>
          </div>
          <button
            onClick={handleCopyId}
            className="p-1 bg-haven-surface hover:bg-haven-surface-hover text-zinc-300 hover:text-white rounded transition-colors cursor-pointer flex-shrink-0"
            title="Copiar ID Completo"
          >
            {copiedId ? <Check className="w-3.5 h-3.5 text-haven-emerald" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Private Invite Code (If applicable) */}
        {selectedCommunity.is_private && selectedCommunity.invite_code && isOwner && (
          <div className="flex items-center justify-between pt-1 border-t border-haven-border/60">
            <div className="min-w-0 pr-1">
              <div className="text-[9px] text-amber-400 font-semibold uppercase tracking-wider">Código de Convite</div>
              <div className="font-mono text-amber-300 font-bold text-[11px]">{selectedCommunity.invite_code}</div>
            </div>
            <button
              onClick={handleCopyInvite}
              className="p-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 rounded transition-colors cursor-pointer flex-shrink-0"
              title="Copiar Código de Convite"
            >
              {copiedInvite ? <Check className="w-3.5 h-3.5 text-haven-emerald" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
      </div>

      {/* Channels List */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4 scrollbar-none">
        {/* Text Channels */}
        <div>
          <div className="flex items-center justify-between px-2 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
            <span>Canais de Texto</span>
            {isOwner && (
              <button
                onClick={() => handleOpenCreateChannel('TEXT')}
                className="hover:text-zinc-200 transition-colors p-0.5 cursor-pointer"
                title="Criar Canal de Texto"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="space-y-0.5">
            {textChannels.map((c) => {
              const isSelected = selectedChannel?.id === c.id;
              const unreadCount = unreadCounts[c.id] || 0;
              const hasUnread = unreadCount > 0 && !isSelected;

              return (
                <button
                  key={c.id}
                  onClick={() => handleChannelClick(c)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors cursor-pointer relative group ${
                    isSelected
                      ? 'bg-haven-surface-hover text-white font-medium shadow-subtle'
                      : hasUnread
                      ? 'text-white font-semibold hover:bg-haven-surface/70'
                      : 'text-zinc-400 hover:bg-haven-surface/50 hover:text-zinc-200'
                  }`}
                  title={hasUnread ? `${c.name} (${unreadCount} não lida(s))` : c.name}
                >
                  <Hash className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-haven-accent' : hasUnread ? 'text-zinc-200' : 'text-zinc-500'}`} />
                  <span className="truncate flex-1 text-left">{c.name}</span>

                  {/* Unread Counter Badge */}
                  {hasUnread && (
                    <span className="ml-auto min-w-[16px] h-[16px] px-1 bg-haven-accent text-white font-bold text-[9px] rounded-full flex items-center justify-center flex-shrink-0">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Voice Channels */}
        <div>
          <div className="flex items-center justify-between px-2 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
            <span>Canais de Voz</span>
            {isOwner && (
              <button
                onClick={() => handleOpenCreateChannel('VOICE')}
                className="hover:text-zinc-200 transition-colors p-0.5 cursor-pointer"
                title="Criar Canal de Voz"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="space-y-1">
            {voiceChannels.map((c) => {
              const isConnected = activeVoiceChannel?.id === c.id;
              const channelMembers = voiceChannelMembers[c.id] || [];

              return (
                <div key={c.id} className="space-y-0.5">
                  <button
                    onClick={() => handleChannelClick(c)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                      isConnected
                        ? 'bg-emerald-950/40 text-haven-emerald border border-emerald-800/40'
                        : 'text-zinc-400 hover:bg-haven-surface/50 hover:text-zinc-200'
                    }`}
                  >
                    <Volume2 className="w-4 h-4 opacity-80 flex-shrink-0" />
                    <span className="truncate">{c.name}</span>
                    {isConnected && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-haven-emerald animate-pulse" />
                    )}
                  </button>

                  {/* Channel Active Users List */}
                  {channelMembers.length > 0 && (
                    <div className="pl-4 pr-1 py-1 space-y-0.5">
                      {channelMembers.map((m) => (
                        <div
                          key={m.user_id}
                          className={`flex items-center justify-between text-xs text-zinc-300 py-0.5 px-2 rounded hover:bg-haven-surface/40 transition-all duration-200 ${
                            participantTransitions[m.user_id] === 'entering'
                              ? 'animate-scale-up bg-haven-emerald/5'
                              : participantTransitions[m.user_id] === 'leaving'
                              ? 'opacity-0 -translate-x-2'
                              : 'opacity-100 translate-x-0'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar name={m.username} size="xs" isSpeaking={m.is_speaking} />
                            <span className="truncate text-[11px] text-zinc-300">{m.username}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {m.is_screen_sharing && (
                              <span className="bg-sky-950/60 text-sky-400 text-[8px] font-semibold px-1 py-0.5 rounded border border-sky-800/40 flex items-center gap-0.5">
                                <Monitor className="w-2 h-2" /> VÍDEO
                              </span>
                            )}
                            {m.is_camera_on && (
                              <span className="bg-indigo-950/60 text-indigo-300 text-[8px] font-semibold px-1 py-0.5 rounded border border-indigo-800/40 flex items-center gap-0.5">
                                <Video className="w-2 h-2" /> CAM
                              </span>
                            )}
                            {m.is_muted && <MicOff className="w-3 h-3 text-haven-rose" />}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active Voice Connection Bar */}
      {activeVoiceChannel && (
        <div className="bg-haven-darkest border-t border-haven-border px-3 py-2 flex items-center justify-between flex-shrink-0">
          <button
            onClick={() => selectChannel(activeVoiceChannel)}
            className="flex items-center gap-2 min-w-0 text-left cursor-pointer group"
          >
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
              voiceConnectionState === 'connected' ? 'bg-haven-emerald' :
              voiceConnectionState === 'error' ? 'bg-haven-rose' : 'bg-haven-amber animate-pulse'
            }`} />
            <div className="min-w-0">
              <div className="text-[10px] font-semibold text-haven-emerald group-hover:underline truncate">
                {voiceConnectionState === 'connected' ? 'Voz conectada' :
                 voiceConnectionState === 'reconnecting' ? 'Reconectando…' :
                 voiceConnectionState === 'error' ? 'Falha na conexão' : 'Conectando…'}
              </div>
              <div className="text-[10px] text-zinc-400 truncate">
                {activeVoiceChannel.name}
              </div>
            </div>
          </button>

          <button
            onClick={disconnectVoice}
            className="p-1.5 rounded-md hover:bg-rose-950/50 text-zinc-400 hover:text-haven-rose transition-colors cursor-pointer"
            title="Desconectar da Voz"
          >
            <PhoneOff className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* User Status Bottom Dock */}
      <div className="min-h-[64px] bg-haven-darker border-t border-haven-border px-3 py-2 flex items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0 py-0.5">
          <Avatar
            src={user?.avatar_url}
            name={user?.username || 'User'}
            size="sm"
            status="online"
          />
          <div className="min-w-0">
            <div className="text-xs font-semibold text-zinc-200 truncate">
              {user?.username || 'Anônimo'}
            </div>
            <div className="text-[10px] text-zinc-400 truncate">
              {user?.is_admin ? 'Admin' : 'Membro'}
            </div>
          </div>
        </div>

        {/* Quick controls */}
        <div className="flex items-center gap-1 text-zinc-400 flex-shrink-0">
          <button
            onClick={toggleMute}
            className={`p-1.5 rounded hover:bg-haven-surface transition-colors cursor-pointer ${
              isMuted ? 'text-haven-rose' : 'hover:text-zinc-200'
            }`}
            title={isMuted ? 'Desmutar' : 'Mutar'}
          >
            {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={toggleDeafen}
            className={`p-1.5 rounded hover:bg-haven-surface transition-colors cursor-pointer ${
              isDeafened ? 'text-haven-rose' : 'hover:text-zinc-200'
            }`}
            title={isDeafened ? 'Ativar Áudio' : 'Ensurdecer'}
          >
            {isDeafened ? <VolumeX className="w-3.5 h-3.5" /> : <Headphones className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => openModal('feedback')}
            className="p-1.5 rounded hover:bg-haven-surface hover:text-zinc-200 transition-colors cursor-pointer"
            title="Relatar Bug / Sugestão"
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => openModal('settings')}
            className="p-1.5 rounded hover:bg-haven-surface hover:text-zinc-200 transition-colors cursor-pointer"
            title="Configurações"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};
