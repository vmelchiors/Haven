import { create } from 'zustand';
import { Channel, VoiceParticipant, VoiceChannelUser } from '../types';
import { useAuthStore } from './authStore';
import { sendWebSocketMessage } from '../hooks/useWebSocket';

interface MediaState {
  activeChannel: Channel | null;
  activeVoiceChannel: Channel | null;
  rtcToken: string | null;
  rtcUrl: string | null;
  roomName: string | null;
  participants: Record<string, VoiceParticipant>;

  isVoiceConnected: boolean;
  voiceConnectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';
  participantTransitions: Record<string, 'entering' | 'leaving'>;
  isMuted: boolean;
  isDeafened: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  isNoiseSuppressionEnabled: boolean;
  isPushToTalkActive: boolean;
  vadLevel: number;
  isSpeaking: boolean;
  focusedParticipant: string | null;
  watchedScreenShares: Record<string, boolean>;

  connectVoice: (channel: Channel, token?: string, url?: string, roomName?: string) => void;
  disconnectVoice: () => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
  toggleCamera: () => void;
  toggleScreenShare: () => void;
  toggleNoiseSuppression: () => void;
  voiceChannelMembers: Record<string, VoiceChannelUser[]>;
  setVoiceSnapshot: (snapshot: VoiceChannelUser[]) => void;
  setUserJoinedVoice: (user: VoiceChannelUser) => void;
  setUserLeftVoice: (channelId: string, userId: string) => void;
  setVoiceStateUpdate: (user: VoiceChannelUser) => void;

  setPushToTalkActive: (active: boolean) => void;
  setVadLevel: (level: number, speaking: boolean) => void;
  setFocusedParticipant: (identity: string | null) => void;
  setScreenShareWatching: (identity: string, watching: boolean) => void;

  upsertParticipant: (participant: Partial<VoiceParticipant> & { identity: string }) => void;
  addParticipant: (participant: VoiceParticipant) => void;
  updateParticipant: (identity: string, updates: Partial<VoiceParticipant>) => void;
  removeParticipant: (identity: string) => void;
  resetParticipants: () => void;
}

export const useMediaStore = create<MediaState>((set) => ({
  activeChannel: null,
  activeVoiceChannel: null,
  rtcToken: null,
  rtcUrl: null,
  roomName: null,
  participants: {},
  voiceChannelMembers: {},

  isVoiceConnected: false,
  voiceConnectionState: 'disconnected',
  participantTransitions: {},
  isMuted: false,
  isDeafened: false,
  isCameraOn: false,
  isScreenSharing: false,
  isNoiseSuppressionEnabled: true,
  isPushToTalkActive: false,
  vadLevel: 0,
  isSpeaking: false,
  focusedParticipant: null,
  watchedScreenShares: {},

  setVoiceSnapshot: (snapshot) => {
    const snapshotUserIds = snapshot.map((voiceUser) => voiceUser.user_id);
    set((state) => {
      const map: Record<string, VoiceChannelUser[]> = {};
      for (const voiceUser of snapshot) {
        if (!map[voiceUser.channel_id]) {
          map[voiceUser.channel_id] = [];
        }
        map[voiceUser.channel_id] = map[voiceUser.channel_id].filter(
          (existing) => existing.user_id !== voiceUser.user_id,
        );
        map[voiceUser.channel_id].push(voiceUser);
      }
      const knownUserIds = new Set(Object.values(state.voiceChannelMembers).flat().map((voiceUser) => voiceUser.user_id));
      const transitions = { ...state.participantTransitions };
      snapshotUserIds.forEach((userId) => {
        if (!knownUserIds.has(userId)) transitions[userId] = 'entering';
      });
      return { voiceChannelMembers: map, participantTransitions: transitions };
    });
    snapshotUserIds.forEach((userId) => {
      window.setTimeout(() => set((state) => {
        if (state.participantTransitions[userId] !== 'entering') return state;
        const transitions = { ...state.participantTransitions };
        delete transitions[userId];
        return { participantTransitions: transitions };
      }), 320);
    });
  },

  setUserJoinedVoice: (user) => {
    set((state) => {
      const existing = state.voiceChannelMembers[user.channel_id] || [];
      const filtered = existing.filter((u) => u.user_id !== user.user_id);
      const newParticipants = { ...state.participants };

      if (state.activeVoiceChannel?.id === user.channel_id && newParticipants[user.user_id]) {
        const p = newParticipants[user.user_id];
        const isCameraOn = Boolean(user.is_camera_on);
        const isScreenSharing = Boolean(user.is_screen_sharing);
        newParticipants[user.user_id] = {
          ...p,
          isCameraOn,
          isScreenSharing,
          isMuted: Boolean(user.is_muted),
          isDeafened: Boolean(user.is_deafened),
          cameraTrack: isCameraOn ? p.cameraTrack : undefined,
          screenTrack: isScreenSharing ? p.screenTrack : undefined,
        };
      }

      return {
        voiceChannelMembers: {
          ...state.voiceChannelMembers,
          [user.channel_id]: [...filtered, user],
        },
        participants: newParticipants,
        participantTransitions: {
          ...state.participantTransitions,
          [user.user_id]: 'entering',
        },
      };
    });
    window.setTimeout(() => set((state) => {
      if (state.participantTransitions[user.user_id] !== 'entering') return state;
      const next = { ...state.participantTransitions };
      delete next[user.user_id];
      return { participantTransitions: next };
    }), 320);
  },

  setUserLeftVoice: (channelId, userId) => {
    set((state) => ({
      participantTransitions: { ...state.participantTransitions, [userId]: 'leaving' },
    }));
    window.setTimeout(() => {
    set((state) => {
      const existing = state.voiceChannelMembers[channelId] || [];
      const filtered = existing.filter((u) => u.user_id !== userId);
      const newParticipants = { ...state.participants };
      delete newParticipants[userId];
      const nextTransitions = { ...state.participantTransitions };
      delete nextTransitions[userId];
      const watchedScreenShares = { ...state.watchedScreenShares };
      delete watchedScreenShares[userId];

      return {
        voiceChannelMembers: {
          ...state.voiceChannelMembers,
          [channelId]: filtered,
        },
        participants: newParticipants,
        focusedParticipant: state.focusedParticipant === userId ? null : state.focusedParticipant,
        watchedScreenShares,
        participantTransitions: nextTransitions,
      };
    });
    }, 240);
  },

  setVoiceStateUpdate: (user) => {
    set((state) => {
      const existing = state.voiceChannelMembers[user.channel_id] || [];
      const hasUser = existing.some((u) => u.user_id === user.user_id);
      const updated = hasUser
        ? existing.map((u) => (u.user_id === user.user_id ? { ...u, ...user } : u))
        : [...existing, user];
      const newParticipants = { ...state.participants };
      const watchedScreenShares = { ...state.watchedScreenShares };
      if (user.is_screen_sharing === false) delete watchedScreenShares[user.user_id];
      if (state.activeVoiceChannel?.id === user.channel_id && newParticipants[user.user_id]) {
        const p = newParticipants[user.user_id];
        const isCameraOn = user.is_camera_on !== undefined ? Boolean(user.is_camera_on) : p.isCameraOn;
        const isScreenSharing = user.is_screen_sharing !== undefined ? Boolean(user.is_screen_sharing) : p.isScreenSharing;

        newParticipants[user.user_id] = {
          ...p,
          name: user.username && user.username !== 'Anonymous' ? user.username : p.name,
          isSpeaking: user.is_speaking !== undefined ? Boolean(user.is_speaking) : p.isSpeaking,
          isMuted: user.is_muted !== undefined ? Boolean(user.is_muted) : p.isMuted,
          isDeafened: user.is_deafened !== undefined ? Boolean(user.is_deafened) : p.isDeafened,
          isCameraOn,
          isScreenSharing,
          cameraTrack: isCameraOn ? p.cameraTrack : undefined,
          screenTrack: isScreenSharing ? p.screenTrack : undefined,
        };
      }
      return {
        voiceChannelMembers: {
          ...state.voiceChannelMembers,
          [user.channel_id]: updated,
        },
        participants: newParticipants,
        watchedScreenShares,
      };
    });
  },

  connectVoice: (channel, token, url, roomName) => {
    const currentUser = useAuthStore.getState().user;
    const state = useMediaStore.getState();

    if (state.activeVoiceChannel && state.activeVoiceChannel.id !== channel.id && currentUser) {
      sendWebSocketMessage({
        type: 'user_left_voice',
        channel_id: state.activeVoiceChannel.id,
        payload: { channel_id: state.activeVoiceChannel.id, user_id: currentUser.id },
      });
    }

    if (currentUser) {
      sendWebSocketMessage({
        type: 'user_joined_voice',
        channel_id: channel.id,
        payload: {
          channel_id: channel.id,
          user_id: currentUser.id,
          username: currentUser.username,
          is_muted: state.isMuted,
          is_deafened: state.isDeafened,
          is_camera_on: state.isCameraOn,
          is_screen_sharing: state.isScreenSharing,
          is_speaking: false,
        },
      });
    }

    set((s) => {
      const existing = s.voiceChannelMembers[channel.id] || [];
      const userList = currentUser
        ? [
            ...existing.filter((u) => u.user_id !== currentUser.id),
            {
              channel_id: channel.id,
              user_id: currentUser.id,
              username: currentUser.username,
              is_muted: s.isMuted,
              is_deafened: s.isDeafened,
              is_camera_on: s.isCameraOn,
              is_screen_sharing: s.isScreenSharing,
              is_speaking: false,
            },
          ]
        : existing;

      return {
        activeVoiceChannel: channel,
        rtcToken: token || s.rtcToken,
        rtcUrl: url || s.rtcUrl,
        roomName: roomName || s.roomName,
        isVoiceConnected: false,
        voiceConnectionState: 'connecting',
        voiceChannelMembers: {
          ...s.voiceChannelMembers,
          [channel.id]: userList,
        },
        participants: s.activeVoiceChannel?.id === channel.id ? s.participants : {},
        watchedScreenShares: s.activeVoiceChannel?.id === channel.id ? s.watchedScreenShares : {},
        participantTransitions: {},
      };
    });
  },

  disconnectVoice: () => {
    const currentUser = useAuthStore.getState().user;
    const currentChannelId = useMediaStore.getState().activeVoiceChannel?.id;

    if (currentChannelId && currentUser) {
      sendWebSocketMessage({
        type: 'user_left_voice',
        channel_id: currentChannelId,
        payload: {
          channel_id: currentChannelId,
          user_id: currentUser.id,
        },
      });
    }

    set((state) => {
      let newMembers = { ...state.voiceChannelMembers };
      if (currentChannelId && currentUser) {
        const existing = newMembers[currentChannelId] || [];
        newMembers[currentChannelId] = existing.filter((u) => u.user_id !== currentUser.id);
      }

      return {
        activeVoiceChannel: null,
        rtcToken: null,
        rtcUrl: null,
        roomName: null,
        isVoiceConnected: false,
        voiceConnectionState: 'disconnected',
        participants: {},
        voiceChannelMembers: newMembers,
        isCameraOn: false,
        isScreenSharing: false,
        focusedParticipant: null,
        watchedScreenShares: {},
        participantTransitions: {},
      };
    });
  },

  toggleMute: () => {
    set((state) => {
      const nextMuted = !state.isMuted;
      const currentUser = useAuthStore.getState().user;
      const activeVoice = state.activeVoiceChannel;
      if (activeVoice && currentUser) {
        sendWebSocketMessage({
          type: 'voice_state_update',
          channel_id: activeVoice.id,
          payload: {
            channel_id: activeVoice.id,
            user_id: currentUser.id,
            username: currentUser.username,
            is_muted: nextMuted,
            is_deafened: state.isDeafened,
            is_camera_on: state.isCameraOn,
            is_screen_sharing: state.isScreenSharing,
          },
        });
      }
      return { isMuted: nextMuted };
    });
  },

  toggleDeafen: () => {
    set((state) => {
      const nextDeafened = !state.isDeafened;
      const nextMuted = nextDeafened ? true : state.isMuted;
      const currentUser = useAuthStore.getState().user;
      const activeVoice = state.activeVoiceChannel;
      if (activeVoice && currentUser) {
        sendWebSocketMessage({
          type: 'voice_state_update',
          channel_id: activeVoice.id,
          payload: {
            channel_id: activeVoice.id,
            user_id: currentUser.id,
            username: currentUser.username,
            is_deafened: nextDeafened,
            is_muted: nextMuted,
            is_camera_on: state.isCameraOn,
            is_screen_sharing: state.isScreenSharing,
          },
        });
      }
      return { isDeafened: nextDeafened, isMuted: nextMuted };
    });
  },

  toggleCamera: () => {
    set((state) => {
      const nextCamera = !state.isCameraOn;
      const currentUser = useAuthStore.getState().user;
      const activeVoice = state.activeVoiceChannel;
      if (activeVoice && currentUser) {
        sendWebSocketMessage({
          type: 'voice_state_update',
          channel_id: activeVoice.id,
          payload: {
            channel_id: activeVoice.id,
            user_id: currentUser.id,
            username: currentUser.username,
            is_camera_on: nextCamera,
            is_screen_sharing: state.isScreenSharing,
            is_muted: state.isMuted || state.isDeafened,
            is_deafened: state.isDeafened,
          },
        });
      }
      return { isCameraOn: nextCamera };
    });
  },

  toggleScreenShare: () => {
    set((state) => {
      const nextScreen = !state.isScreenSharing;
      const currentUser = useAuthStore.getState().user;
      const activeVoice = state.activeVoiceChannel;
      if (activeVoice && currentUser) {
        sendWebSocketMessage({
          type: 'voice_state_update',
          channel_id: activeVoice.id,
          payload: {
            channel_id: activeVoice.id,
            user_id: currentUser.id,
            username: currentUser.username,
            is_screen_sharing: nextScreen,
            is_camera_on: state.isCameraOn,
            is_muted: state.isMuted || state.isDeafened,
            is_deafened: state.isDeafened,
          },
        });
      }
      return { isScreenSharing: nextScreen };
    });
  },

  toggleNoiseSuppression: () =>
    set((state) => ({ isNoiseSuppressionEnabled: !state.isNoiseSuppressionEnabled })),
  setPushToTalkActive: (active) => set({ isPushToTalkActive: active }),
  setVadLevel: (level, isSpeaking) =>
    set((state) => {
      if (state.isSpeaking === isSpeaking && Math.abs(state.vadLevel - level) < 0.03) {
        return state;
      }
      return { vadLevel: level, isSpeaking };
    }),
  setFocusedParticipant: (identity) => set({ focusedParticipant: identity }),
  setScreenShareWatching: (identity, watching) =>
    set((state) => {
      const watchedScreenShares = { ...state.watchedScreenShares };
      if (watching) watchedScreenShares[identity] = true;
      else delete watchedScreenShares[identity];
      return {
        watchedScreenShares,
        focusedParticipant: watching ? identity : state.focusedParticipant === identity ? null : state.focusedParticipant,
      };
    }),

  upsertParticipant: (p) => {
    set((state) => {
      const currentUser = useAuthStore.getState().user;
      const existing = state.participants[p.identity];

      const isGenericName = (name?: string, identity?: string): boolean => {
        if (!name || name === 'Anonymous') return true;
        if (identity && name === identity) return true;
        if (/^User [0-9a-fA-F]{4,6}$/.test(name)) return true;
        return false;
      };

      const resolveName = (providedName?: string): string => {
        if (currentUser && p.identity === currentUser.id && currentUser.username) {
          return currentUser.username;
        }
        if (providedName && !isGenericName(providedName, p.identity)) {
          return providedName;
        }
        if (existing?.name && !isGenericName(existing.name, p.identity)) {
          return existing.name;
        }
        const activeVoice = state.activeVoiceChannel;
        if (activeVoice) {
          const members = state.voiceChannelMembers[activeVoice.id] || [];
          const m = members.find((u) => u.user_id === p.identity);
          if (m?.username && !isGenericName(m.username, p.identity)) {
            return m.username;
          }
        }
        if (providedName && providedName !== 'Anonymous' && providedName !== p.identity) {
          return providedName;
        }
        return `User ${p.identity.slice(0, 4)}`;
      };

      const finalName = resolveName(p.name);

      if (existing) {
        let hasDiff = false;
        const merged: VoiceParticipant = { ...existing };
        for (const key in p) {
          const val = (p as any)[key];
          if (val !== undefined) {
            if (key === 'name') {
              if (finalName !== existing.name) {
                hasDiff = true;
                merged.name = finalName;
              }
              continue;
            }
            if ((existing as any)[key] !== val) {
              hasDiff = true;
              (merged as any)[key] = val;
            }
          }
        }
        if (!hasDiff && merged.name === existing.name) return state;
        return {
          participants: {
            ...state.participants,
            [p.identity]: { ...merged, name: finalName },
          },
        };
      }

      // Guard: do not create a participant if not current user and not present in active channel
      const isSelf = currentUser && p.identity === currentUser.id;
      if (!isSelf && state.activeVoiceChannel) {
        const channelMembers = state.voiceChannelMembers[state.activeVoiceChannel.id] || [];
        if (!channelMembers.some((m) => m.user_id === p.identity)) {
          return state;
        }
      }

      const defaultParticipant: VoiceParticipant = {
        identity: p.identity,
        name: finalName,
        isSpeaking: false,
        isMuted: false,
        isDeafened: false,
        isCameraOn: false,
        isScreenSharing: false,
        audioLevel: 0,
      };

      const initial: VoiceParticipant = { ...defaultParticipant };
      for (const key in p) {
        const val = (p as any)[key];
        if (val !== undefined) {
          if (key === 'name') {
            continue;
          }
          (initial as any)[key] = val;
        }
      }
      initial.name = finalName;

      return {
        participants: {
          ...state.participants,
          [p.identity]: initial,
        },
      };
    });
  },

  addParticipant: (p) => {
    set((state) => ({
      participants: {
        ...state.participants,
        [p.identity]: p,
      },
    }));
  },

  updateParticipant: (identity, updates) => {
    set((state) => {
      const existing = state.participants[identity];
      if (!existing) return state;
      return {
        participants: {
          ...state.participants,
          [identity]: { ...existing, ...updates },
        },
      };
    });
  },

  removeParticipant: (identity) => {
    set((state) => {
      const next = { ...state.participants };
      delete next[identity];
      return {
        participants: next,
        focusedParticipant: state.focusedParticipant === identity ? null : state.focusedParticipant,
      };
    });
  },

  resetParticipants: () => set({ participants: {} }),
}));
