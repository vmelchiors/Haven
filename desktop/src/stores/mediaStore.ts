import { create } from 'zustand';
import { Channel, VoiceParticipant, VoiceChannelUser } from '../types';
import { useAuthStore } from './authStore';
import { sendWebSocketMessage } from '../hooks/useWebSocket';

export type NoiseSuppressionStatus = 'idle' | 'loading' | 'active' | 'fallback' | 'disabled';
export type RemoteAudioSource = 'voice' | 'screen';

export interface RemoteAudioPreference {
  voiceVolume: number;
  voiceMuted: boolean;
  screenVolume: number;
  screenMuted: boolean;
}

interface MediaState {
  activeChannel: Channel | null;
  activeVoiceChannel: Channel | null;
  rtcToken: string | null;
  rtcUrl: string | null;
  roomName: string | null;
  participants: Record<string, VoiceParticipant>;

  isVoiceConnected: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  isNoiseSuppressionEnabled: boolean;
  noiseSuppressionStatus: NoiseSuppressionStatus;
  isPushToTalkActive: boolean;
  vadLevel: number;
  isSpeaking: boolean;
  focusedParticipant: string | null;
  remoteAudioPreferences: Record<string, RemoteAudioPreference>;
  isCompanionModeEnabled: boolean;

  connectVoice: (channel: Channel, token?: string, url?: string, roomName?: string) => void;
  disconnectVoice: () => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
  toggleCamera: () => void;
  toggleScreenShare: () => void;
  toggleNoiseSuppression: () => void;
  setNoiseSuppressionStatus: (status: NoiseSuppressionStatus) => void;
  voiceChannelMembers: Record<string, VoiceChannelUser[]>;
  setVoiceSnapshot: (snapshot: VoiceChannelUser[]) => void;
  setUserJoinedVoice: (user: VoiceChannelUser) => void;
  setUserLeftVoice: (channelId: string, userId: string) => void;
  setVoiceStateUpdate: (user: VoiceChannelUser) => void;

  setPushToTalkActive: (active: boolean) => void;
  setVadLevel: (level: number, speaking: boolean) => void;
  setFocusedParticipant: (identity: string | null) => void;
  setRemoteAudioVolume: (identity: string, source: RemoteAudioSource, volume: number) => void;
  toggleRemoteAudioMuted: (identity: string, source: RemoteAudioSource) => void;
  toggleCompanionMode: () => void;

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
  isMuted: false,
  isDeafened: false,
  isCameraOn: false,
  isScreenSharing: false,
  isNoiseSuppressionEnabled: true,
  noiseSuppressionStatus: 'idle',
  isPushToTalkActive: false,
  vadLevel: 0,
  isSpeaking: false,
  focusedParticipant: null,
  remoteAudioPreferences: {},
  isCompanionModeEnabled: false,

  setVoiceSnapshot: (snapshot) => {
    set((state) => {
      const map: Record<string, VoiceChannelUser[]> = { ...state.voiceChannelMembers };
      for (const u of snapshot) {
        if (!map[u.channel_id]) {
          map[u.channel_id] = [];
        }
        map[u.channel_id] = map[u.channel_id].filter((existing) => existing.user_id !== u.user_id);
        map[u.channel_id].push(u);
      }
      return { voiceChannelMembers: map };
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
      };
    });
  },

  setUserLeftVoice: (channelId, userId) => {
    set((state) => {
      const existing = state.voiceChannelMembers[channelId] || [];
      const filtered = existing.filter((u) => u.user_id !== userId);
      const newParticipants = { ...state.participants };
      delete newParticipants[userId];

      return {
        voiceChannelMembers: {
          ...state.voiceChannelMembers,
          [channelId]: filtered,
        },
        participants: newParticipants,
        focusedParticipant: state.focusedParticipant === userId ? null : state.focusedParticipant,
      };
    });
  },

  setVoiceStateUpdate: (user) => {
    set((state) => {
      const existing = state.voiceChannelMembers[user.channel_id] || [];
      const updated = existing.map((u) => (u.user_id === user.user_id ? { ...u, ...user } : u));
      const newParticipants = { ...state.participants };
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
      };
    });
  },

  connectVoice: (channel, token, url, roomName) => {
    const currentUser = useAuthStore.getState().user;
    const state = useMediaStore.getState();

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
        isVoiceConnected: true,
        voiceChannelMembers: {
          ...s.voiceChannelMembers,
          [channel.id]: userList,
        },
        participants: s.activeVoiceChannel?.id === channel.id ? s.participants : {},
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
        participants: {},
        voiceChannelMembers: newMembers,
        isCameraOn: false,
        isScreenSharing: false,
        focusedParticipant: null,
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
    set((state) => {
      const enabled = !state.isNoiseSuppressionEnabled;
      return {
        isNoiseSuppressionEnabled: enabled,
        noiseSuppressionStatus: enabled ? 'idle' : 'disabled',
      };
    }),
  setNoiseSuppressionStatus: (status) => set({ noiseSuppressionStatus: status }),
  setPushToTalkActive: (active) => set({ isPushToTalkActive: active }),
  setVadLevel: (level, isSpeaking) =>
    set((state) => {
      if (state.isSpeaking === isSpeaking && Math.abs(state.vadLevel - level) < 0.03) {
        return state;
      }
      return { vadLevel: level, isSpeaking };
    }),
  setFocusedParticipant: (identity) => set({ focusedParticipant: identity }),
  setRemoteAudioVolume: (identity, source, volume) =>
    set((state) => {
      const current = state.remoteAudioPreferences[identity] || {
        voiceVolume: 100,
        voiceMuted: false,
        screenVolume: 100,
        screenMuted: false,
      };
      const volumeKey = source === 'voice' ? 'voiceVolume' : 'screenVolume';
      return {
        remoteAudioPreferences: {
          ...state.remoteAudioPreferences,
          [identity]: { ...current, [volumeKey]: Math.min(100, Math.max(0, Math.round(volume))) },
        },
      };
    }),
  toggleRemoteAudioMuted: (identity, source) =>
    set((state) => {
      const current = state.remoteAudioPreferences[identity] || {
        voiceVolume: 100,
        voiceMuted: false,
        screenVolume: 100,
        screenMuted: false,
      };
      const mutedKey = source === 'voice' ? 'voiceMuted' : 'screenMuted';
      return {
        remoteAudioPreferences: {
          ...state.remoteAudioPreferences,
          [identity]: { ...current, [mutedKey]: !current[mutedKey] },
        },
      };
    }),
  toggleCompanionMode: () => set((state) => ({ isCompanionModeEnabled: !state.isCompanionModeEnabled })),

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
