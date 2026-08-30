import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useMediaStore } from '../stores/mediaStore';

describe('MediaStore', () => {
  beforeEach(() => {
    useMediaStore.setState({
      activeChannel: null,
      isVoiceConnected: false,
      isMuted: false,
      isDeafened: false,
      isCameraOn: false,
      isScreenSharing: false,
      isNoiseSuppressionEnabled: true,
      isSpeaking: false,
      vadLevel: 0,
      participants: {},
      focusedParticipant: null,
    });
  });

  it('should toggle mute and deafen state', () => {
    useMediaStore.getState().toggleMute();
    expect(useMediaStore.getState().isMuted).toBe(true);

    useMediaStore.getState().toggleDeafen();
    expect(useMediaStore.getState().isDeafened).toBe(true);
    expect(useMediaStore.getState().isMuted).toBe(true); // Deafen also mutes mic
  });

  it('should toggle RNNoise noise suppression', () => {
    expect(useMediaStore.getState().isNoiseSuppressionEnabled).toBe(true);
    useMediaStore.getState().toggleNoiseSuppression();
    expect(useMediaStore.getState().isNoiseSuppressionEnabled).toBe(false);
  });

  it('should add and update remote voice participants', () => {
    useMediaStore.getState().addParticipant({
      identity: 'user_p1',
      name: 'Bob',
      isSpeaking: false,
      isMuted: false,
      isDeafened: false,
      isCameraOn: false,
      isScreenSharing: false,
      audioLevel: 0,
    });

    expect(useMediaStore.getState().participants['user_p1']).toBeDefined();
    expect(useMediaStore.getState().participants['user_p1'].name).toBe('Bob');

    useMediaStore.getState().updateParticipant('user_p1', { isSpeaking: true });
    expect(useMediaStore.getState().participants['user_p1'].isSpeaking).toBe(true);

    useMediaStore.getState().removeParticipant('user_p1');
    expect(useMediaStore.getState().participants['user_p1']).toBeUndefined();
  });

  it('should resolve and preserve valid usernames in upsertParticipant', () => {
    useMediaStore.getState().upsertParticipant({
      identity: 'user_1234',
      name: 'flame',
    });

    expect(useMediaStore.getState().participants['user_1234'].name).toBe('flame');

    // Attempt to overwrite with generic name 'User 1234'
    useMediaStore.getState().upsertParticipant({
      identity: 'user_1234',
      name: 'User 1234',
    });

    expect(useMediaStore.getState().participants['user_1234'].name).toBe('flame');
  });

  it('should toggle camera and screen share', () => {
    expect(useMediaStore.getState().isCameraOn).toBe(false);
    useMediaStore.getState().toggleCamera();
    expect(useMediaStore.getState().isCameraOn).toBe(true);

    expect(useMediaStore.getState().isScreenSharing).toBe(false);
    useMediaStore.getState().toggleScreenShare();
    expect(useMediaStore.getState().isScreenSharing).toBe(true);
  });

  it('should clean up participants and reset focus when user leaves voice', () => {
    vi.useFakeTimers();
    useMediaStore.setState({
      activeVoiceChannel: { id: 'ch_1', name: 'General', type: 'VOICE', community_id: 'c_1', position: 0 },
      voiceChannelMembers: {
        ch_1: [
          { channel_id: 'ch_1', user_id: 'user_a', username: 'User A', is_muted: false, is_deafened: false, is_speaking: false, is_camera_on: false, is_screen_sharing: false },
          { channel_id: 'ch_1', user_id: 'user_b', username: 'User B', is_muted: false, is_deafened: false, is_speaking: false, is_camera_on: false, is_screen_sharing: false },
        ],
      },
      participants: {
        user_a: { identity: 'user_a', name: 'User A', isSpeaking: false, isMuted: false, isDeafened: false, isCameraOn: false, isScreenSharing: false, audioLevel: 0 },
        user_b: { identity: 'user_b', name: 'User B', isSpeaking: false, isMuted: false, isDeafened: false, isCameraOn: false, isScreenSharing: false, audioLevel: 0 },
      },
      focusedParticipant: 'user_b',
    });

    useMediaStore.getState().setUserLeftVoice('ch_1', 'user_b');

    expect(useMediaStore.getState().participantTransitions['user_b']).toBe('leaving');
    expect(useMediaStore.getState().participants['user_b']).toBeDefined();

    vi.advanceTimersByTime(240);
    expect(useMediaStore.getState().participants['user_b']).toBeUndefined();
    expect(useMediaStore.getState().focusedParticipant).toBeNull();
    expect(useMediaStore.getState().voiceChannelMembers['ch_1'].some((u) => u.user_id === 'user_b')).toBe(false);

    // Attempt to resurrect user_b with upsertParticipant when not in channel
    useMediaStore.getState().upsertParticipant({
      identity: 'user_b',
      name: 'User B',
    });

    expect(useMediaStore.getState().participants['user_b']).toBeUndefined();
    vi.useRealTimers();
  });

  it('should replace voice snapshots and clear each entrance transition safely', () => {
    vi.useFakeTimers();
    useMediaStore.setState({ voiceChannelMembers: {}, participantTransitions: {} });

    useMediaStore.getState().setVoiceSnapshot([
      { channel_id: 'ch_1', user_id: 'user_a', username: 'User A', is_muted: false, is_deafened: false, is_speaking: false, is_camera_on: false, is_screen_sharing: false },
      { channel_id: 'ch_2', user_id: 'user_b', username: 'User B', is_muted: false, is_deafened: false, is_speaking: false, is_camera_on: false, is_screen_sharing: false },
    ]);

    expect(useMediaStore.getState().voiceChannelMembers.ch_1[0].user_id).toBe('user_a');
    expect(useMediaStore.getState().voiceChannelMembers.ch_2[0].user_id).toBe('user_b');
    expect(useMediaStore.getState().participantTransitions).toEqual({ user_a: 'entering', user_b: 'entering' });

    vi.advanceTimersByTime(320);
    expect(useMediaStore.getState().participantTransitions).toEqual({});
    vi.useRealTimers();
  });
});


