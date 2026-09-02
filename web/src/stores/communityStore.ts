import { create } from 'zustand';
import { Community, Channel, ChannelType, User } from '../types';
import { useAuthStore } from './authStore';
import { useChatStore } from './chatStore';

interface CommunityState {
  communities: Community[];
  pendingCommunities: Community[];
  selectedCommunity: Community | null;
  selectedChannel: Channel | null;
  members: User[];
  isLoading: boolean;
  error: string | null;

  fetchCommunities: () => Promise<void>;
  fetchPendingCommunities: () => Promise<void>;
  fetchMembers: (communityId: string) => Promise<void>;
  selectCommunity: (communityId: string) => Promise<void>;
  selectChannel: (channel: Channel | null) => void;
  createCommunity: (name: string, description: string, receiptFile: File, iconFile?: File, isPrivate?: boolean) => Promise<Community | null>;
  updateCommunity: (communityId: string, name: string, description: string, isPrivate: boolean, iconFile?: File) => Promise<Community | null>;
  joinCommunity: (identifier: string) => Promise<Community | null>;
  approveCommunity: (communityId: string) => Promise<boolean>;
  rejectCommunity: (communityId: string, rejectionReason?: string) => Promise<boolean>;
  createChannel: (communityId: string, name: string, type: ChannelType) => Promise<Channel | null>;
  deleteCommunity: (communityId: string) => Promise<boolean>;
  deleteChannel: (channelId: string) => Promise<boolean>;
  updateMemberProfile: (userId: string, username: string, avatarUrl: string) => void;
}

export const useCommunityStore = create<CommunityState>((set, get) => ({
  communities: [],
  pendingCommunities: [],
  selectedCommunity: null,
  selectedChannel: null,
  members: [],
  isLoading: false,
  error: null,

  updateMemberProfile: (userId, username, avatarUrl) => set((state) => ({
    members: state.members.map((member) => member.id === userId
      ? { ...member, username: username || member.username, avatar_url: avatarUrl || member.avatar_url }
      : member),
  })),

  fetchCommunities: async () => {
    const tokens = useAuthStore.getState().tokens;
    if (!tokens) return;

    set({ isLoading: true, error: null });
    try {
      const res = await fetch('/api/communities', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      if (!res.ok) {
        if (res.status === 403) {
          const data = await res.json().catch(() => ({}));
          if (data.requires_tos) {
            useAuthStore.setState({ requiresToS: true });
          }
        }
        throw new Error('Erro ao listar comunidades');
      }

      const list: Community[] = await res.json();
      set({ communities: list, isLoading: false });

      // If no community is selected and we have communities, select the first
      if (!get().selectedCommunity && list.length > 0) {
        await get().selectCommunity(list[0].id);
      }
    } catch (err: any) {
      set({ isLoading: false, error: err.message });
    }
  },

  fetchPendingCommunities: async () => {
    const tokens = useAuthStore.getState().tokens;
    if (!tokens) return;

    try {
      const res = await fetch('/api/admin/communities/pending', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      if (res.ok) {
        const list: Community[] = await res.json();
        set({ pendingCommunities: list });
      }
    } catch (err) {
      // Ignored
    }
  },

  fetchMembers: async (communityId: string) => {
    const tokens = useAuthStore.getState().tokens;
    if (!tokens || !communityId) return;

    try {
      const res = await fetch(`/api/communities/${communityId}/members`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (res.ok) {
        const membersList = await res.json();
        if (get().selectedCommunity?.id === communityId) {
          set({ members: membersList || [] });
        }
      }
    } catch (err) {
      // Ignored
    }
  },

  selectCommunity: async (communityId: string) => {
    const tokens = useAuthStore.getState().tokens;
    if (!tokens) return;

    set({ isLoading: true, members: [] });
    try {
      const res = await fetch(`/api/communities/${communityId}`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      if (!res.ok) throw new Error('Erro ao carregar detalhes da comunidade');

      const data = await res.json();
      set({ selectedCommunity: data, isLoading: false });

      // Fetch community members for the sidebar
      get().fetchMembers(communityId);

      // Automatically select the first TEXT channel if none or invalid
      if (data.channels && data.channels.length > 0) {
        const firstTextChannel = data.channels.find((c: Channel) => c.type === 'TEXT') || data.channels[0];
        set({ selectedChannel: firstTextChannel });
        if (firstTextChannel) {
          useChatStore.getState().markChannelAsRead(firstTextChannel.id);
        }
      } else {
        set({ selectedChannel: null });
      }
    } catch (err: any) {
      set({ isLoading: false, error: err.message });
    }
  },

  selectChannel: (channel: Channel | null) => {
    set({ selectedChannel: channel });
    if (channel) {
      useChatStore.getState().markChannelAsRead(channel.id);
    }
  },

  createCommunity: async (name, description, receiptFile, iconFile, isPrivate = false) => {
    const tokens = useAuthStore.getState().tokens;
    if (!tokens) return null;

    set({ isLoading: true, error: null });
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('description', description);
      formData.append('receipt_file', receiptFile);
      formData.append('is_private', isPrivate ? 'true' : 'false');
      if (iconFile) {
        formData.append('icon', iconFile);
      }

      const res = await fetch('/api/communities', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Erro ao solicitar criação da comunidade');
      }

      const newComm: Community = await res.json();
      set({ isLoading: false });
      return newComm;
    } catch (err: any) {
      set({ isLoading: false, error: err.message });
      return null;
    }
  },

  updateCommunity: async (communityId, name, description, isPrivate, iconFile) => {
    const tokens = useAuthStore.getState().tokens;
    if (!tokens) return null;

    set({ isLoading: true, error: null });
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('description', description);
      formData.append('is_private', isPrivate ? 'true' : 'false');
      if (iconFile) {
        formData.append('icon', iconFile);
      }

      const res = await fetch(`/api/communities/${communityId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Erro ao atualizar comunidade');
      }

      const updated: Community = await res.json();
      set((state) => ({
        communities: state.communities.map((c) => (c.id === communityId ? { ...c, ...updated } : c)),
        selectedCommunity: state.selectedCommunity?.id === communityId ? { ...state.selectedCommunity, ...updated } : state.selectedCommunity,
        isLoading: false,
      }));
      return updated;
    } catch (err: any) {
      set({ isLoading: false, error: err.message });
      return null;
    }
  },

  joinCommunity: async (identifier: string) => {
    const tokens = useAuthStore.getState().tokens;
    if (!tokens) return null;

    set({ isLoading: true, error: null });
    try {
      const res = await fetch('/api/communities/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.access_token}`,
        },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'ID ou código de convite inválido ou expirado');
      }

      const joined: Community = await res.json();
      await get().fetchCommunities();
      await get().selectCommunity(joined.id);
      set({ isLoading: false });
      return joined;
    } catch (err: any) {
      set({ isLoading: false, error: err.message });
      return null;
    }
  },

  approveCommunity: async (communityId: string) => {
    const tokens = useAuthStore.getState().tokens;
    if (!tokens) return false;

    try {
      const res = await fetch(`/api/admin/communities/${communityId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      if (res.ok) {
        await get().fetchCommunities();
        await get().fetchPendingCommunities();
        return true;
      }
      return false;
    } catch (err) {
      return false;
    }
  },

  rejectCommunity: async (communityId: string, rejectionReason?: string) => {
    const tokens = useAuthStore.getState().tokens;
    if (!tokens) return false;

    try {
      const res = await fetch(`/api/admin/communities/${communityId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.access_token}`,
        },
        body: JSON.stringify({ rejection_reason: rejectionReason || '' }),
      });

      if (res.ok) {
        await get().fetchPendingCommunities();
        return true;
      }
      return false;
    } catch (err) {
      return false;
    }
  },

  createChannel: async (communityId, name, type) => {
    const tokens = useAuthStore.getState().tokens;
    if (!tokens) return null;

    try {
      const res = await fetch(`/api/communities/${communityId}/channels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.access_token}`,
        },
        body: JSON.stringify({ name, type }),
      });

      if (!res.ok) throw new Error('Erro ao criar canal');

      const ch: Channel = await res.json();
      // Reload current community channels
      await get().selectCommunity(communityId);
      return ch;
    } catch (err: any) {
      set({ error: err.message });
      return null;
    }
  },

  deleteCommunity: async (communityId: string) => {
    const tokens = useAuthStore.getState().tokens;
    if (!tokens) return false;

    try {
      const res = await fetch(`/api/communities/${communityId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      if (res.ok) {
        const remaining = get().communities.filter((c) => c.id !== communityId);
        set((state) => ({
          communities: remaining,
          selectedCommunity: state.selectedCommunity?.id === communityId ? (remaining[0] || null) : state.selectedCommunity,
        }));
        if (remaining.length > 0 && get().selectedCommunity?.id === communityId) {
          await get().selectCommunity(remaining[0].id);
        }
        return true;
      }
      return false;
    } catch (err) {
      return false;
    }
  },

  deleteChannel: async (channelId: string) => {
    const tokens = useAuthStore.getState().tokens;
    if (!tokens) return false;

    try {
      const res = await fetch(`/api/channels/${channelId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      if (res.ok) {
        const currentComm = get().selectedCommunity;
        if (currentComm) {
          await get().selectCommunity(currentComm.id);
        }
        return true;
      }
      return false;
    } catch (err) {
      return false;
    }
  },
}));
