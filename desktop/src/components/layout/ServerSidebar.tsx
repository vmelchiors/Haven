import React from 'react';
import { Plus, Heart, Shield, KeyRound, Lock, Download } from 'lucide-react';
import { useCommunityStore } from '../../stores/communityStore';
import { useFeedbackStore } from '../../stores/feedbackStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAuthStore } from '../../stores/authStore';
import { useChatStore } from '../../stores/chatStore';

export const ServerSidebar: React.FC = () => {
  const communities = useCommunityStore((s) => s.communities);
  const selectedCommunity = useCommunityStore((s) => s.selectedCommunity);
  const selectCommunity = useCommunityStore((s) => s.selectCommunity);
  const pendingCommunities = useCommunityStore((s) => s.pendingCommunities);
  const feedbacks = useFeedbackStore((s) => s.feedbacks);
  const unreadCounts = useChatStore((s) => s.unreadCounts);
  const channelToCommunity = useChatStore((s) => s.channelToCommunity);

  const openModal = useSettingsStore((s) => s.openModal);
  const user = useAuthStore((s) => s.user);

  const pendingFeedbackCount = feedbacks.filter((f) => f.status === 'OPEN' || f.status === 'IN_PROGRESS').length;
  const totalAdminPending = pendingCommunities.length + pendingFeedbackCount;

  return (
    <nav aria-label="Servidores" className="w-[68px] bg-haven-darkest border-r border-haven-border flex flex-col items-center py-3 gap-2 select-none flex-shrink-0 z-30">
      {/* Haven Home Logo Button */}
      <div className="relative group flex items-center justify-center w-full">
        <span
          className={`absolute -left-1 w-1 bg-white rounded-r-full transition-all duration-200 ${
            selectedCommunity === null ? 'h-9' : 'h-0 group-hover:h-4'
          }`}
        />
        <button
          onClick={() => openModal('home')}
          className="w-11 h-11 rounded-[20px] hover:rounded-[14px] bg-haven-accent text-white flex items-center justify-center transition-all duration-200 shadow-subtle cursor-pointer active:scale-95"
          title="Haven Home — Início & Downloads"
        >
          <span className="font-bold text-base tracking-tight">H</span>
        </button>
      </div>

      <div className="w-8 h-px bg-haven-border my-0.5" />

      {/* Community Servers List */}
      <div className="flex-1 w-full flex flex-col items-center gap-2 overflow-y-auto overflow-x-hidden scrollbar-none px-2">
        {communities.map((comm) => {
          const isSelected = selectedCommunity?.id === comm.id;
          const knownChannels = (comm.id === selectedCommunity?.id && selectedCommunity.channels ? selectedCommunity.channels : comm.channels) || [];
          let unreadCount = knownChannels.reduce((sum, ch) => sum + (unreadCounts[ch.id] || 0), 0);

          for (const [chId, count] of Object.entries(unreadCounts)) {
            if (count > 0 && channelToCommunity[chId] === comm.id && !knownChannels.some((ch) => ch.id === chId)) {
              unreadCount += count;
            }
          }

          const hasUnread = unreadCount > 0;

          return (
            <div key={comm.id} className="relative group flex items-center justify-center w-full">
              {/* Left active/hover/unread indicator pill */}
              <span
                className={`absolute -left-1 w-1 bg-white rounded-r-full transition-all duration-200 ${
                  isSelected ? 'h-9' : hasUnread ? 'h-2' : 'h-0 group-hover:h-4'
                }`}
              />

              <button
                onClick={() => selectCommunity(comm.id)}
                className={`relative w-11 h-11 flex items-center justify-center font-bold text-xs transition-all duration-200 cursor-pointer overflow-hidden ${
                  isSelected
                    ? 'bg-haven-accent text-white rounded-[14px] shadow-subtle'
                    : 'bg-haven-surface hover:bg-haven-accent text-zinc-300 hover:text-white rounded-[20px] hover:rounded-[14px]'
                }`}
                title={`${comm.name}${comm.is_private ? ' (Privada 🔒)' : ''}${hasUnread ? ` • ${unreadCount} não lida(s)` : ''}`}
              >
                {comm.icon_url ? (
                  <img
                    src={comm.icon_url}
                    alt={comm.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  comm.name.slice(0, 2).toUpperCase()
                )}

                {/* Private lock badge */}
                {comm.is_private && (
                  <div
                    className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-amber-500 text-zinc-950 rounded-tl-md flex items-center justify-center"
                    title="Comunidade Privada"
                  >
                    <Lock className="w-2 h-2" />
                  </div>
                )}
              </button>

              {/* Unread message count badge */}
              {hasUnread && (
                <span
                  className="absolute -top-1 -right-0.5 min-w-[16px] h-[16px] px-1 bg-haven-rose text-white font-bold text-[9px] rounded-full flex items-center justify-center ring-2 ring-haven-darkest pointer-events-none shadow-subtle"
                  title={`${unreadCount} novas mensagens`}
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
          );
        })}

        {/* Add Community Action */}
        <div className="relative group flex items-center justify-center w-full">
          <button
            onClick={() => openModal('create_community')}
            className="w-11 h-11 rounded-[20px] hover:rounded-[14px] bg-haven-surface hover:bg-haven-emerald text-haven-emerald hover:text-white flex items-center justify-center transition-all duration-200 cursor-pointer active:scale-95"
            title="Criar Comunidade (R$ 15,00 anti-spam)"
          >
            <Plus className="w-5 h-5 transition-transform group-hover:rotate-90 duration-200" />
          </button>
        </div>

        {/* Join Community by Invite Code */}
        <div className="relative group flex items-center justify-center w-full">
          <button
            onClick={() => openModal('join_community')}
            className="w-11 h-11 rounded-[20px] hover:rounded-[14px] bg-haven-surface hover:bg-amber-500 text-amber-400 hover:text-zinc-950 flex items-center justify-center transition-all duration-200 cursor-pointer active:scale-95"
            title="Entrar com Código de Convite"
          >
            <KeyRound className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bottom Utility Actions */}
      <div className="w-full flex flex-col items-center gap-2 pt-2 border-t border-haven-border">
        {user?.is_admin && (
          <div className="relative">
            <button
              onClick={() => openModal('admin_moderation')}
              className="w-11 h-11 rounded-[20px] hover:rounded-[14px] bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-zinc-950 flex items-center justify-center transition-all duration-200 cursor-pointer active:scale-95"
              title="Painel de Moderação Admin"
            >
              <Shield className="w-4 h-4" />
            </button>
            {totalAdminPending > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-haven-rose text-white text-[9px] font-bold rounded-full flex items-center justify-center ring-2 ring-haven-darkest pointer-events-none">
                {totalAdminPending}
              </span>
            )}
          </div>
        )}

        {/* Download App */}
        <button
          onClick={() => openModal('download')}
          className="w-11 h-11 rounded-[20px] hover:rounded-[14px] bg-haven-surface hover:bg-haven-surface-hover text-zinc-400 hover:text-haven-cyan flex items-center justify-center transition-all duration-200 cursor-pointer active:scale-95"
          title="Baixar App Desktop"
        >
          <Download className="w-4 h-4" />
        </button>

        {/* PIX Donation */}
        <button
          onClick={() => openModal('donate')}
          className="w-11 h-11 rounded-[20px] hover:rounded-[14px] bg-haven-surface hover:bg-haven-surface-hover text-zinc-400 hover:text-rose-400 flex items-center justify-center transition-all duration-200 cursor-pointer active:scale-95"
          title="Apoiar com PIX"
        >
          <Heart className="w-4 h-4" />
        </button>
      </div>
    </nav>
  );
};
