import { useEffect, useCallback } from 'react';
import { STORAGE_KEY_USER, useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { useMediaStore } from '../stores/mediaStore';
import { useCommunityStore } from '../stores/communityStore';
import { WSMessage, Message, VoiceChannelUser } from '../types';

let socket: WebSocket | null = null;
let pingInterval: number | null = null;
let reconnectTimer: number | null = null;
let isConnecting = false;
let messageQueue: WSMessage[] = [];

const webrtcSignalListeners = new Set<(msg: WSMessage) => void>();

export function subscribeToWebSocketEvents(listener: (msg: WSMessage) => void) {
  webrtcSignalListeners.add(listener);
  return () => {
    webrtcSignalListeners.delete(listener);
  };
}

export function sendWebSocketMessage(msg: WSMessage) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(msg));
  } else {
    // Queue message so it is never dropped during initial connect / reconnect
    messageQueue.push(msg);
  }
}

function setupWebSocket(accessToken: string) {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }
  if (isConnecting) return;
  isConnecting = true;

  try {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws?token=${encodeURIComponent(accessToken)}`;

    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      isConnecting = false;
      if (pingInterval) clearInterval(pingInterval);
      pingInterval = window.setInterval(() => {
        if (socket?.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'ping' }));
        }
      }, 25000);

      // Flush all queued messages immediately
      const toSend = [...messageQueue];
      messageQueue = [];
      for (const msg of toSend) {
        if (socket?.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(msg));
        }
      }

      // Automatically re-announce voice presence if connected
      const activeVoice = useMediaStore.getState().activeVoiceChannel || useMediaStore.getState().activeChannel;
      const currentUser = useAuthStore.getState().user;
      if (activeVoice && currentUser) {
        const mediaState = useMediaStore.getState();
        sendWebSocketMessage({
          type: 'user_joined_voice',
          channel_id: activeVoice.id,
          payload: {
            channel_id: activeVoice.id,
            user_id: currentUser.id,
            username: currentUser.username,
            is_muted: mediaState.isMuted || mediaState.isDeafened,
            is_deafened: mediaState.isDeafened,
            is_camera_on: mediaState.isCameraOn,
            is_screen_sharing: mediaState.isScreenSharing,
          },
        });
      }
    };

    socket.onmessage = (event) => {
      try {
        const lines = typeof event.data === 'string' ? event.data.split('\n') : [event.data];
        for (const line of lines) {
          if (!line || !line.trim()) continue;
          const msg: WSMessage = JSON.parse(line);
          const { addMessage, setTyping, setPresence } = useChatStore.getState();

          switch (msg.type) {
            case 'chat_message':
              if (msg.payload) {
                addMessage(msg.payload as Message);
              }
              break;
            case 'user_typing':
              if (msg.payload) {
                const { channel_id, user_id, username, is_typing } = msg.payload;
                setTyping(channel_id, user_id, username, is_typing);
              }
              break;
            case 'presence_update':
              if (msg.payload) {
                const { user_id, status, username } = msg.payload;
                setPresence(user_id, status, username);
              }
              break;
            case 'user_profile_updated':
              if (msg.payload) {
                const { user_id, username, avatar_url } = msg.payload;
                if (!user_id || !avatar_url) break;
                useCommunityStore.getState().updateMemberProfile(user_id, username, avatar_url);
                useChatStore.getState().updateUserProfile(user_id, username, avatar_url);
                useMediaStore.getState().updateParticipant(user_id, { name: username });

                const currentUser = useAuthStore.getState().user;
                if (currentUser && currentUser.id === user_id) {
                  const updatedUser = { ...currentUser, username: username || currentUser.username, avatar_url };
                  localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updatedUser));
                  useAuthStore.setState({ user: updatedUser });
                }
              }
              break;
            case 'voice_snapshot':
              if (msg.payload && Array.isArray(msg.payload)) {
                useMediaStore.getState().setVoiceSnapshot(msg.payload);
                webrtcSignalListeners.forEach((fn) => fn(msg));
              }
              break;
            case 'user_joined_voice':
              if (msg.payload) {
                useMediaStore.getState().setUserJoinedVoice(msg.payload);
                webrtcSignalListeners.forEach((fn) => fn(msg));
              }
              break;
            case 'user_left_voice':
              if (msg.payload) {
                useMediaStore.getState().setUserLeftVoice(msg.payload.channel_id, msg.payload.user_id);
                webrtcSignalListeners.forEach((fn) => fn(msg));
              }
              break;
            case 'voice_state_update':
              if (msg.payload) {
                useMediaStore.getState().setVoiceStateUpdate(msg.payload);
                webrtcSignalListeners.forEach((fn) => fn(msg));
              }
              break;
            case 'webrtc_signal':
              if (msg.payload) {
                webrtcSignalListeners.forEach((fn) => fn(msg));
              }
              break;
          }
        }
      } catch (err) {
        console.error('[WS] Parse error:', err);
      }
    };

    socket.onclose = () => {
      isConnecting = false;
      if (pingInterval) clearInterval(pingInterval);
      socket = null;

      // Reconnect if still authenticated
      if (useAuthStore.getState().isAuthenticated) {
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = window.setTimeout(async () => {
          try {
            await useAuthStore.getState().checkAuth();
            const freshToken = useAuthStore.getState().tokens?.access_token;
            if (freshToken) {
              setupWebSocket(freshToken);
            }
          } catch {
            const currentToken = useAuthStore.getState().tokens?.access_token;
            if (currentToken) setupWebSocket(currentToken);
          }
        }, 1500);
      }
    };

    socket.onerror = () => {
      isConnecting = false;
      socket?.close();
    };
  } catch {
    isConnecting = false;
  }
}

export function useWebSocket() {
  const tokens = useAuthStore((s) => s.tokens);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (isAuthenticated && tokens?.access_token) {
      setupWebSocket(tokens.access_token);
    } else {
      if (socket) {
        socket.close();
        socket = null;
      }
      if (pingInterval) clearInterval(pingInterval);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      isConnecting = false;
    }
  }, [isAuthenticated, tokens?.access_token]);

  const sendChatMessage = useCallback((channelId: string, content: string) => {
    sendWebSocketMessage({
      type: 'chat_message',
      channel_id: channelId,
      payload: {
        channel_id: channelId,
        content,
      },
    });
  }, []);

  const sendTypingIndicator = useCallback((channelId: string, isTyping: boolean) => {
    sendWebSocketMessage({
      type: 'user_typing',
      channel_id: channelId,
      payload: {
        channel_id: channelId,
        is_typing: isTyping,
      },
    });
  }, []);

  const sendPresenceUpdate = useCallback((status: string) => {
    sendWebSocketMessage({
      type: 'presence_update',
      payload: {
        status,
      },
    });
  }, []);

  const sendVoiceJoin = useCallback((channelId: string, user: Partial<VoiceChannelUser>) => {
    sendWebSocketMessage({
      type: 'user_joined_voice',
      channel_id: channelId,
      payload: {
        channel_id: channelId,
        ...user,
      },
    });
  }, []);

  const sendVoiceLeave = useCallback((channelId: string) => {
    sendWebSocketMessage({
      type: 'user_left_voice',
      channel_id: channelId,
      payload: {
        channel_id: channelId,
      },
    });
  }, []);

  const sendVoiceState = useCallback((channelId: string, state: Partial<VoiceChannelUser>) => {
    sendWebSocketMessage({
      type: 'voice_state_update',
      channel_id: channelId,
      payload: {
        channel_id: channelId,
        ...state,
      },
    });
  }, []);

  const sendWebRTCSignal = useCallback((channelId: string, targetUserId: string, signal: any) => {
    sendWebSocketMessage({
      type: 'webrtc_signal',
      channel_id: channelId,
      payload: {
        channel_id: channelId,
        target_user_id: targetUserId,
        signal,
      },
    });
  }, []);

  return {
    sendChatMessage,
    sendTypingIndicator,
    sendPresenceUpdate,
    sendVoiceJoin,
    sendVoiceLeave,
    sendVoiceState,
    sendWebRTCSignal,
    isConnected: socket?.readyState === WebSocket.OPEN,
  };
}
