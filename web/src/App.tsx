import React, { useEffect } from 'react';
import { Shield, Plus, Heart, Download } from 'lucide-react';
import { useAuthStore } from './stores/authStore';
import { useCommunityStore } from './stores/communityStore';
import { useMediaStore } from './stores/mediaStore';
import { useSettingsStore } from './stores/settingsStore';
import { useWebSocket } from './hooks/useWebSocket';
import { useLiveKit } from './hooks/useLiveKit';
import { usePushToTalk } from './hooks/usePushToTalk';

// Layout
import { ServerSidebar } from './components/layout/ServerSidebar';
import { ChannelSidebar } from './components/layout/ChannelSidebar';
import { MemberList } from './components/layout/MemberList';
import { AuthView } from './components/auth/AuthView';

// Features
import { ChatArea } from './components/chat/ChatArea';
import { VoiceRoom } from './components/media/VoiceRoom';
import { VoiceChannelPreview } from './components/media/VoiceChannelPreview';

// Modals
import { ToSModal } from './components/modals/ToSModal';
import { CreateCommunityModal } from './components/modals/CreateCommunityModal';
import { EditCommunityModal } from './components/modals/EditCommunityModal';
import { JoinCommunityModal } from './components/modals/JoinCommunityModal';
import { CreateChannelModal } from './components/modals/CreateChannelModal';
import { AdminModerationModal } from './components/modals/AdminModerationModal';
import { FeedbackModal } from './components/modals/FeedbackModal';
import { DonationModal } from './components/modals/DonationModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { DownloadModal } from './components/modals/DownloadModal';
import { HomeModal } from './components/modals/HomeModal';
import { Button } from './components/ui/Button';

export const App: React.FC = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);

  const selectedChannel = useCommunityStore((s) => s.selectedChannel);
  const activeVoiceChannel = useMediaStore((s) => s.activeVoiceChannel);
  const openModal = useSettingsStore((s) => s.openModal);

  // Initialize Global WebSocket sync
  useWebSocket();

  // Initialize Global WebRTC Voice Engine (Remains connected across all channel navigations like Discord)
  useLiveKit();

  // Initialize Global Push-to-Talk listener
  usePushToTalk();

  useEffect(() => {
    useAuthStore.getState().checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      useCommunityStore.getState().fetchCommunities();
      if (user?.is_admin) {
        useCommunityStore.getState().fetchPendingCommunities();
      }
    }
  }, [isAuthenticated, user?.is_admin]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-haven-darkest text-zinc-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-haven-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-[11px] font-medium tracking-wide uppercase text-zinc-500">Iniciando Haven...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <AuthView />
        <DonationModal />
      </>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-haven-darkest text-zinc-100 font-sans select-none antialiased">
      {/* 1. Server Sidebar */}
      <ServerSidebar />

      {/* 2. Channel Sidebar */}
      <ChannelSidebar />

      {/* 3. Main Stage: Text Chat or Voice Room */}
      <main className="flex-1 flex overflow-hidden relative">
        {selectedChannel && selectedChannel.type === 'TEXT' ? (
          <ChatArea channel={selectedChannel} />
        ) : activeVoiceChannel ? (
          <VoiceRoom channel={activeVoiceChannel} />
        ) : selectedChannel && selectedChannel.type === 'VOICE' ? (
          <VoiceChannelPreview channel={selectedChannel} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-haven-darker">
            <div className="w-12 h-12 rounded-2xl bg-haven-accent text-white flex items-center justify-center mb-3 shadow-subtle">
              <span className="font-bold text-xl tracking-tight">H</span>
            </div>
            <h3 className="text-base font-semibold text-zinc-100 tracking-tight">Haven</h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-sm leading-relaxed font-normal">
              Comunicação em tempo real, cancelamento neural de ruído RNNoise e arquitetura Zero-PII por design.
            </p>

            <div className="flex items-center gap-2 mt-5 flex-wrap justify-center">
              <Button
                variant="primary"
                size="sm"
                onClick={() => openModal('create_community')}
                className="gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Criar Comunidade
              </Button>

              {user?.is_admin && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => openModal('admin_moderation')}
                  className="gap-1.5 text-amber-400"
                >
                  <Shield className="w-3.5 h-3.5" />
                  Moderação
                </Button>
              )}

              <Button
                variant="secondary"
                size="sm"
                onClick={() => openModal('download')}
                className="gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                App Desktop
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => openModal('donate')}
                className="gap-1.5 text-rose-400"
              >
                <Heart className="w-3.5 h-3.5" />
                Apoiar PIX
              </Button>
            </div>
          </div>
        )}

        {/* 4. Member List (Right dock) */}
        <MemberList />
      </main>

      {/* Modals Container */}
      <ToSModal />
      <CreateCommunityModal />
      <EditCommunityModal />
      <JoinCommunityModal />
      <CreateChannelModal />
      <AdminModerationModal />
      <FeedbackModal />
      <DonationModal />
      <SettingsModal />
      <DownloadModal />
      <HomeModal />
    </div>
  );
};
