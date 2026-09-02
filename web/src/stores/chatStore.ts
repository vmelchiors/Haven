import { create } from 'zustand';
import { Message, PresenceStatus, UserPresence } from '../types';
import { useAuthStore } from './authStore';
import { useCommunityStore } from './communityStore';

interface ChatState {
  messages: Record<string, Message[]>;
  unreadCounts: Record<string, number>; // channelId -> count of unread messages
  channelToCommunity: Record<string, string>; // channelId -> communityId
  typingUsers: Record<string, Record<string, string>>; // channelId -> userId -> username
  presence: Record<string, UserPresence>; // userId -> UserPresence
  hasMore: Record<string, boolean>;
  isLoadingMessages: boolean;

  fetchMessages: (channelId: string, beforeId?: string) => Promise<void>;
  addMessage: (message: Message) => void;
  markChannelAsRead: (channelId: string) => void;
  setTyping: (channelId: string, userId: string, username: string, isTyping: boolean) => void;
  setPresence: (userId: string, status: PresenceStatus, username?: string) => void;
  updateUserProfile: (userId: string, username: string, avatarUrl: string) => void;
  clearChannelMessages: (channelId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: {},
  unreadCounts: {},
  channelToCommunity: {},
  typingUsers: {},
  presence: {},
  hasMore: {},
  isLoadingMessages: false,

  fetchMessages: async (channelId: string, beforeId?: string) => {
    const tokens = useAuthStore.getState().tokens;
    if (!tokens || !channelId) return;

    // Clear unread count when viewing/fetching messages
    get().markChannelAsRead(channelId);

    set({ isLoadingMessages: true });
    try {
      const url = new URL(`/api/channels/${channelId}/messages`, window.location.origin);
      url.searchParams.set('limit', '50');
      if (beforeId) {
        url.searchParams.set('before', beforeId);
      }

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      if (!res.ok) throw new Error('Erro ao carregar mensagens');

      const newMsgs: Message[] = await res.json();
      const currentMsgs = get().messages[channelId] || [];

      // Map channel to community if present in messages
      const nextMap = { ...get().channelToCommunity };
      for (const m of newMsgs) {
        if (m.channel_id && m.community_id) {
          nextMap[m.channel_id] = m.community_id;
        }
      }

      if (beforeId) {
        const combined = [...newMsgs, ...currentMsgs];
        const unique = Array.from(new Map(combined.map((m) => [m.id, m])).values());
        set((state) => ({
          messages: { ...state.messages, [channelId]: unique },
          channelToCommunity: nextMap,
          hasMore: { ...state.hasMore, [channelId]: newMsgs.length >= 50 },
          isLoadingMessages: false,
        }));
      } else {
        set((state) => ({
          messages: { ...state.messages, [channelId]: newMsgs },
          channelToCommunity: nextMap,
          hasMore: { ...state.hasMore, [channelId]: newMsgs.length >= 50 },
          isLoadingMessages: false,
        }));
      }
    } catch (err) {
      set({ isLoadingMessages: false });
    }
  },

  addMessage: (message: Message) => {
    const channelId = message.channel_id;
    if (!channelId) return;

    const currentUserId = useAuthStore.getState().user?.id;
    const selectedChannelId = useCommunityStore.getState().selectedChannel?.id;

    // Resolve communityId from message or store
    let communityId = message.community_id || get().channelToCommunity[channelId];
    if (!communityId) {
      const comms = useCommunityStore.getState().communities || [];
      for (const c of comms) {
        if (c.channels?.some((ch) => ch.id === channelId)) {
          communityId = c.id;
          break;
        }
      }
    }

    set((state) => {
      const existing = state.messages[channelId] || [];
      if (existing.some((m) => m.id === message.id)) {
        return state;
      }

      const isCurrent = selectedChannelId === channelId;
      const isFromSelf = message.user_id === currentUserId;
      const unread = (!isCurrent && !isFromSelf) ? (state.unreadCounts[channelId] || 0) + 1 : 0;

      const nextUnread = { ...state.unreadCounts };
      if (unread > 0) {
        nextUnread[channelId] = unread;
      } else {
        delete nextUnread[channelId];
      }

      const nextMap = { ...state.channelToCommunity };
      if (communityId) {
        nextMap[channelId] = communityId;
      }

      return {
        messages: {
          ...state.messages,
          [channelId]: [...existing, message],
        },
        unreadCounts: nextUnread,
        channelToCommunity: nextMap,
      };
    });
  },

  markChannelAsRead: (channelId: string) => {
    set((state) => {
      if (!state.unreadCounts[channelId]) return state;
      const next = { ...state.unreadCounts };
      delete next[channelId];
      return { unreadCounts: next };
    });
  },

  setTyping: (channelId, userId, username, isTyping) => {
    set((state) => {
      const channelTyping = { ...(state.typingUsers[channelId] || {}) };
      if (isTyping) {
        channelTyping[userId] = username;
      } else {
        delete channelTyping[userId];
      }
      return {
        typingUsers: {
          ...state.typingUsers,
          [channelId]: channelTyping,
        },
      };
    });
  },

  setPresence: (userId, status, username) => {
    set((state) => {
      const updated = { ...state.presence };
      if (status === 'offline') {
        delete updated[userId];
      } else {
        const existingUsername = updated[userId]?.username;
        updated[userId] = {
          user_id: userId,
          username: username || existingUsername || userId,
          status,
        };
      }
      return {
        presence: updated,
      };
    });
  },

  updateUserProfile: (userId, username, avatarUrl) => set((state) => {
    const presence = { ...state.presence };
    if (presence[userId]) {
      presence[userId] = {
        ...presence[userId],
        username: username || presence[userId].username,
        avatar_url: avatarUrl || presence[userId].avatar_url,
      };
    }

    const messages = Object.fromEntries(
      Object.entries(state.messages).map(([channelId, channelMessages]) => [
        channelId,
        channelMessages.map((message) => message.user_id === userId
          ? { ...message, username: username || message.username, avatar_url: avatarUrl || message.avatar_url }
          : message),
      ]),
    );
    return { presence, messages };
  }),

  clearChannelMessages: (channelId) => {
    set((state) => {
      const next = { ...state.messages };
      delete next[channelId];
      return { messages: next };
    });
  },
}));
